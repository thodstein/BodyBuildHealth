import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { calcFertility } from '../../engines/fertility.engine';
import type { FertilityInput, FertilityResult, LabPoint, CourseEntry } from '../../core/types';
import { FERTILITY_TARGET, FERTILITY_TAU_WEEKS } from '../../core/constants';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';
import { generatePCTPlan } from '../../engines/pct-planner.engine';
import { PHARMA_DB } from '../../core/pharma-database';

type FertTab = 'overview' | 'pct-plan' | 'hrt' | 'analyses';
type AnalysesSubTab = 'before' | 'during' | 'after' | 'spermogram' | 'instrumental' | 'structure';

const addToPlan = async (substanceId: string, doseValue: number, doseUnit: string, freq: string, startWeek: number, endWeek: number) => {
  try {
    await db.put('course_log', {
      id: crypto.randomUUID(),
      substanceId,
      doseValue,
      doseUnit,
      frequency: freq,
      startWeek,
      endWeek,
    });
    return true;
  } catch { return false; }
};

const addToCart = (id: string, name: string, dose: string) => {
  try {
    const existing = JSON.parse(localStorage.getItem('supportCart') || '[]');
    if (existing.some((x: any) => x.id === id)) return false;
    localStorage.setItem('supportCart', JSON.stringify([...existing, { id, name, dose, timing: 'daily' }]));
    return true;
  } catch { return false; }
};

const s: Record<string, React.CSSProperties> = {
  card: { background: 'rgba(24,24,27,0.15)', borderRadius: 14, padding: 12, marginBottom: 8, border: '1px solid rgba(255,255,255,0.04)' },
  row: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: 700, opacity: 0.75, marginBottom: 4, letterSpacing: '0.2px', color: 'rgba(255,255,255,0.85)' },
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: 15, boxSizing: 'border-box' as const, outline: 'none', transition: 'border 0.2s' },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.85)', fontSize: 12, cursor: 'pointer' },
  btnActive: { padding: '8px 14px', borderRadius: 8, border: '1px solid #00e68a', background: 'rgba(0,230,138,0.12)', color: '#00e68a', fontSize: 12, cursor: 'pointer', fontWeight: 700 },
  barTrack: { height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', margin: '4px 0' },
  check: { width: 18, height: 18, accentColor: '#00e68a', cursor: 'pointer' },
};

const VARICOCELE = [
  { id: 'none', label: 'Нет' }, { id: 'grade1', label: '1 степень' },
  { id: 'grade2', label: '2 степень' }, { id: 'grade3', label: '3 степень' }
] as const;

export const FertilityPCTScreen: React.FC<{ initialTab?: FertTab; restrictToMode?: 'pct' | 'hrt' | 'fertility' }> = ({ initialTab, restrictToMode }) => {
  const [tab, setTab] = useState<FertTab>(initialTab || 'overview');
  useEffect(() => { setTab(initialTab || 'overview'); }, [initialTab]);

  const [analysesSTab, setAnalysesSTab] = useState<AnalysesSubTab>('before');

  // Filter tabs based on mode
  const fertTabsAll: { id: FertTab; label: string }[] = [
    { id: 'overview', label: '📋 Ориентировочные протоколы' },
    { id: 'pct-plan', label: 'ПКТ базовый протокол' },
    { id: 'hrt', label: '⚕️ Ориентировочные протоколы ГЗТ' },
    { id: 'analyses', label: '🧪 Анализы' },
  ];
  const fertTabs = fertTabsAll.filter(t => {
    if (!restrictToMode) return true;
    if (restrictToMode === 'pct') return ['pct-plan', 'analyses'].includes(t.id);
    if (restrictToMode === 'hrt') return ['hrt', 'analyses'].includes(t.id);
    if (restrictToMode === 'fertility') return ['overview', 'analyses'].includes(t.id);
    return true;
  });

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

  const [pctCourse, setPctCourse] = useState<CourseEntry[]>([]);
  const [pctPlan, setPctPlan] = useState<ReturnType<typeof generatePCTPlan> | null>(null);
  const CLASS_COLORS: Record<string, string> = { pct_serm: '#22c55e', pct_aromatase: '#ef4444', pct_dopamine: '#eab308', pct_gonadotropin: '#3b82f6' };
  const CLASS_LABEL_PCT: Record<string, string> = { pct_serm: 'СЕРМ', pct_aromatase: 'Ингиб.ароматазы', pct_dopamine: 'Дофамин', pct_gonadotropin: 'Гонадотропин' };
  useEffect(() => {
    db.init().then(() => db.getAll<CourseEntry>('course_log')).then(data => setPctCourse(data)).catch(() => {});
  }, []);

  const [allLabs, setAllLabs] = useState<Record<string, string>>({});
  const [labEntries, setLabEntries] = useState<LabPoint[]>([]);
  useEffect(() => {
    const loadLabs = async () => {
      try {
        const profile = getProfile();
        const entries = await db.getAll<LabPoint>('labs_log');
        setLabEntries(entries);
        const codeMap: Record<string, React.Dispatch<React.SetStateAction<string>>> = {
          TT: setTt, FT: setFt, E2: setE2, LH: setLh, FSH: setFsh,
          PRL: setPrl, SHBG: setShbg, INHB: setInhb, AMH: setAmh
        };
        entries
          .filter(e => e.patientId === (profile.id || 'current-user'))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .forEach(e => {
            const setter = codeMap[e.code];
            if (setter && e.value !== undefined) setter(String(e.value));
            if (e.value !== undefined) allLabs[e.code] = String(e.value);
          });
        setAllLabs({ ...allLabs });
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
    <div style={{ marginBottom: 6 }}>
      <div style={s.label}>{label}</div>
      <input type="number" step={step} value={val || ''} onChange={e => set(e.target.value)} placeholder={placeholder} style={s.input} />
    </div>
  );

  const lastLabDate = labEntries.length > 0
    ? labEntries.filter(e => e.date).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date?.split('T')[0]
    : null;

  const fertilityLabs = ['LH', 'FSH', 'TT', 'FT', 'E2', 'PRL', 'SHBG'];
  const checkedCount = fertilityLabs.filter(c => allLabs[c]).length;

  const [labChecklist, setLabChecklist] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fertility_lab_checklist');
      if (saved) setLabChecklist(JSON.parse(saved));
    } catch {}
  }, []);
  const toggleLabCheck = (code: string) => {
    const next = { ...labChecklist, [code]: !labChecklist[code] };
    setLabChecklist(next);
    localStorage.setItem('fertility_lab_checklist', JSON.stringify(next));
  };

  const generateDoctorReport = () => {
    const lines: string[] = [];
    lines.push('=== ОТЧЁТ ДЛЯ ВРАЧА ===');
    lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')}`);
    lines.push('');
    lines.push('📊 Индекс фертильности IF: ' + result.ifScore);
    lines.push('Интерпретация: ' + result.interpretation);
    if (result.spermIndex !== undefined) lines.push('Суб-индекс спермы: ' + result.spermIndex);
    if (result.hormonalIndex !== undefined) lines.push('Суб-индекс гормонов: ' + result.hormonalIndex);
    if (result.structuralIndex !== undefined) lines.push('Суб-индекс структуры: ' + result.structuralIndex);
    lines.push('');
    lines.push('💉 Гормоны:');
    if (lh) lines.push('  LH: ' + lh + ' mIU/mL');
    if (fsh) lines.push('  FSH: ' + fsh + ' mIU/mL');
    if (tt) lines.push('  TT: ' + tt + ' ng/dL');
    if (ft) lines.push('  FT: ' + ft + ' pg/mL');
    if (e2) lines.push('  E2: ' + e2 + ' pg/mL');
    if (prl) lines.push('  PRL: ' + prl + ' ng/mL');
    if (shbg) lines.push('  SHBG: ' + shbg + ' nmol/L');
    if (amh) lines.push('  AMH: ' + amh + ' ng/mL');
    lines.push('');
    if (pctPlan) {
      lines.push('💊 ПКТ протокол:');
      lines.push('  Начало: неделя ' + pctPlan.pctStartWeek);
      pctPlan.pctProtocol.forEach((p: any) => {
        lines.push(`  ${PHARMA_DB[p.substanceId]?.name || p.substanceId}: ${p.doseValue}${p.doseUnit}, нед ${p.startWeek}-${p.endWeek}`);
      });
    }
    lines.push('');
    lines.push('Прогноз 6 нед: ' + result.forecast6w);
    lines.push('Прогноз 12 нед: ' + result.forecast12w);
    if (result.warnings && result.warnings.length > 0) {
      lines.push('');
      lines.push('⚠ Предупреждения:');
      result.warnings.forEach(w => lines.push('  - ' + w));
    }
    alert(lines.join('\n'));
  };

  return (
    <div className="screen fertility-pct" style={{ paddingBottom: 70 }}>

      <div style={{
        display: 'flex', gap: 5, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' as const,
        WebkitOverflowScrolling: 'touch', paddingBottom: 4, msOverflowStyle: 'none' as const,
      }}>
        {fertTabs.map(t => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap',
                padding: '8px 16px', borderRadius: 24, fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                background: isActive ? 'var(--accent)' : 'var(--glass-bg)',
                color: isActive ? '#000' : 'var(--text-dim)',
                border: isActive ? 'none' : '1px solid var(--glass-border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >{t.label}</button>
          );
        })}
      </div>

      <div style={{ width: '100%', overflowX: 'hidden', overflowY: 'auto', wordBreak: 'break-word' }}>

      {/* ─── OVERVIEW TAB ─── */}
      {tab === 'overview' && restrictToMode !== 'fertility' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Quick-reference cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>🧬 Фертильность</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Статус гормонов</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>LH</span>
                  <span style={{ fontWeight: 600, color: lh ? (parseFloat(lh) >= 1.7 ? '#22c55e' : '#ef4444') : '#666' }}>{lh || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>FSH</span>
                  <span style={{ fontWeight: 600, color: fsh ? (parseFloat(fsh) >= 1.5 ? '#22c55e' : '#ef4444') : '#666' }}>{fsh || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>TT</span>
                  <span style={{ fontWeight: 600, color: tt ? (parseFloat(tt) >= 300 ? '#22c55e' : '#ff9800') : '#666' }}>{tt || '—'}</span>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>💊 ПКТ</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Протокол</div>
              <div style={{ fontSize: 9 }}>
                {pctPlan ? (
                  <div style={{ color: '#22c55e', fontWeight: 600 }}>
                    Активен: {pctPlan.pctProtocol.length} преп., старт нед {pctPlan.pctStartWeek}
                  </div>
                ) : pctCourse.length > 0 ? (
                  <div style={{ color: '#ff9800', fontWeight: 600 }}>Курс найден, ПКТ не сгенерирован</div>
                ) : (
                  <div style={{ color: 'var(--text-dim)' }}>Нет активного курса</div>
                )}
              </div>
            </div>
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>⚕️ ГЗТ</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>ТРТ статус</div>
              <div style={{ fontSize: 9 }}>
                {tt ? (parseFloat(tt) < 300 ? (
                  <div style={{ color: '#ff9800', fontWeight: 600 }}>Уровень TT низкий. Возможна необходимость ТРТ.</div>
                ) : (
                  <div style={{ color: '#22c55e', fontWeight: 600 }}>Уровень TT в норме</div>
                )) : (
                  <div style={{ color: 'var(--text-dim)' }}>Нет данных TT</div>
                )}
              </div>
            </div>
            <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>📊 Анализы</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {lastLabDate || 'Нет данных'}
              </div>
              <div style={{ display: 'flex', gap: 3, fontSize: 9 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: checkedCount >= 6 ? '#22c55e' : checkedCount >= 3 ? '#ff9800' : '#ef4444',
                  display: 'inline-block',
                }} />
                <span style={{ color: 'var(--text-dim)' }}>Гормоны: {checkedCount}/{fertilityLabs.length}</span>
              </div>
            </div>
          </div>

          {/* Action cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setTab('pct-plan')} style={{
              width: '100%', padding: 12, borderRadius: 14, cursor: 'pointer', textAlign: 'left' as const,
              background: 'var(--glass-bg)', border: '1px solid rgba(0,230,138,0.2)',
              color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00e68a' }}>Запустить ПКТ</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Генерация протокола восстановления</div>
              </div>
              <span style={{ color: '#00e68a', fontSize: 14 }}>→</span>
            </button>

            <button onClick={() => setTab('analyses')} style={{
              width: '100%', padding: 12, borderRadius: 14, cursor: 'pointer', textAlign: 'left' as const,
              background: 'var(--glass-bg)', border: '1px solid rgba(245,158,11,0.2)',
              color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🧪</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>Заказать анализы</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {Object.values(labChecklist).filter(Boolean).length > 0
                    ? `Выбрано: ${Object.values(labChecklist).filter(Boolean).length} тестов`
                    : 'Список рекомендуемых анализов'}
                </div>
              </div>
              <span style={{ color: '#f59e0b', fontSize: 14 }}>→</span>
            </button>

            <button onClick={generateDoctorReport} style={{
              width: '100%', padding: 12, borderRadius: 14, cursor: 'pointer', textAlign: 'left' as const,
              background: 'var(--glass-bg)', border: '1px solid rgba(59,130,246,0.2)',
              color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>👨‍⚕️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>Отчёт для врача</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Генерация сводки по фертильности</div>
              </div>
              <span style={{ color: '#3b82f6', fontSize: 14 }}>→</span>
            </button>
          </div>

          {/* Lab checklist (shown inline on overview) */}
          <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#f59e0b' }}>🧪 Рекомендуемые анализы для заказа</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
              {[
                { code: 'LH', name: 'LH' }, { code: 'FSH', name: 'FSH' }, { code: 'TT', name: 'Тестостерон общий' },
                { code: 'FT', name: 'Тестостерон своб.' }, { code: 'E2', name: 'Эстрадиол' }, { code: 'PRL', name: 'Пролактин' },
                { code: 'SHBG', name: 'SHBG' }, { code: 'TSH', name: 'TSH' }, { code: 'FT4', name: 'T4 своб.' },
                { code: 'CORT', name: 'Кортизол' }, { code: 'PSA', name: 'ПСА' }, { code: 'VITD', name: 'Витамин D' },
                { code: 'SPERM', name: 'Спермограмма' }, { code: 'INHB', name: 'Ингибин B' }, { code: 'CBC', name: 'ОАК' },
              ].map(item => (
                <label key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--text)', padding: '3px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!labChecklist[item.code]}
                    onChange={() => toggleLabCheck(item.code)}
                    style={{ width: 14, height: 14, accentColor: '#f59e0b', cursor: 'pointer' }}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </div>

          {/* IF Score card */}
          {/* Fertility analyses */}
          <div style={{ ...s.card, borderLeft:'3px solid #ec4899' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#ec4899' }}>🧪 Анализы для оценки фертильности</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {[
                { code:'INHB', name:'Ингибин B', range:'>80 pg/mL', note:'Золотой маркер сперматогенеза. Секретируется клетками Сертоли.' },
                { code:'AMH', name:'Антимюллеров гормон', range:'>3 ng/mL', note:'Оценка овариального резерва (у женщин) и функции клеток Сертоли (у мужчин)' },
                { code:'FSH', name:'ФСГ', range:'1.5-12.4', note:'Высокий ФСГ + низкий ингибин B = нарушение сперматогенеза' },
                { code:'LH', name:'ЛГ', range:'1.7-8.6', note:'Стимуляция клеток Лейдига для продукции тестостерона' },
                { code:'TT', name:'Тестостерон общий', range:'300-1000', note:'Субстрат для интратестикулярного тестостерона (в 100× выше крови)' },
                { code:'E2', name:'Эстрадиол', range:'11-44', note:'Ароматизация Т → E2, влияет на эректильную функцию' },
                { code:'PRL', name:'Пролактин', range:'4-15.2', note:'Гиперпролактинемия → импотенция, гипогонадизм' },
                { code:'SHBG', name:'ГСПГ (SHBG)', range:'18-54', note:'Связывает тестостерон, влияет на свободный Т' },
                { code:'SPERM', name:'Спермограмма', range:'Объём≥1.5мл, PR≥32%', note:'Прямая оценка фертильности. Концентрация ≥15 млн/мл' },
                { code:'DFI', name:'Фрагментация ДНК сперматозоидов (DFI)', range:'<15%', note:'Целостность генетического материала. Выше = хуже имплантация' },
              ].map((a, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:6, background:'rgba(236,72,153,0.04)', border:'1px solid rgba(236,72,153,0.08)', flexWrap:'wrap', gap:2 }}>
                  <div style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{a.code} — {a.name} <span style={{ color:'var(--text-dim)', fontWeight:400 }}>({a.range})</span></div>
                  <span style={{ fontSize:7, color:'#ec4899', opacity:0.7 }}>{a.note}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Instrumental for Fertility */}
          <div style={{ ...s.card, borderLeft:'3px solid #a855f7' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#a855f7' }}>🔬 Инструментальные исследования</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {[
                { name:'УЗИ мошонки с допплером', purpose:'Кровоток яичек, варикоцеле, объём яичек' },
                { name:'Спермограмма + MAR-тест', purpose:'Количество, подвижность, морфология, антиспермальные антитела' },
                { name:'Фрагментация ДНК (SCD/Halosperm)', purpose:'Целостность хроматина, DFI < 15%' },
                { name:'УЗИ простаты (трансректальное)', purpose:'Исключение инфекции/воспаления' },
                { name:'Гормональный профиль (кровь)', purpose:'ЛГ, ФСГ, ТТ, Е2, Пролактин, Ингибин В, АМГ' },
              ].map((e, i) => (
                <div key={i} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                  <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{e.name}</span>
                  <span style={{ fontSize:8, color:'var(--text-dim)', marginLeft:4 }}>— {e.purpose}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...s.card, borderColor: scoreColor, background: scoreBg, border: `1px solid ${scoreColor}` }}>
            <h3 style={{ color: scoreColor, margin: '0 0 8px', fontSize: 16 }}>Индекс фертильности: {result.ifScore}</h3>
            <p style={{ color: scoreColor, margin: '0 0 4px', fontSize: 11 }}>{result.interpretation}</p>
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

          {/* Recovery chart */}
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Прогноз восстановления</h4>
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

          {/* Recommendations */}
          <div style={s.card}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Рекомендации по ПКТ и восстановлению</h4>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              <h5 style={{ fontSize: 12, margin: '0 0 4px' }}>HCG на цикле</h5>
              <p style={{ fontSize: 11, margin: '0 0 8px' }}>500 МЕ 2 раза в неделю (схема 3/1: 3 нед приема, 1 нед отдых) начиная с 3-й недели цикла.</p>
              <h5 style={{ fontSize: 12, margin: '0 0 4px' }}>ПКТ: Кломифен</h5>
              <p style={{ fontSize: 11, margin: '0 0 8px' }}>50 мг/день — 2 нед, затем 25 мг/день — 2 нед.</p>
              <h5 style={{ fontSize: 12, margin: '0 0 4px' }}>ПКТ: Тамоксифен (альтернатива)</h5>
              <p style={{ fontSize: 11, margin: '0 0 8px' }}>20 мг/день — 4 недели.</p>
              <h5 style={{ fontSize: 12, margin: '0 0 4px' }}>Нутритивная поддержка</h5>
              <ul style={{ fontSize: 11, margin: '0 0 8px', paddingLeft: 16 }}>
                <li>Цинк 30 мг/день</li><li>Селен 100 мкг/день</li><li>L-карнитин 1 г/день</li><li>CoQ10 200 мг/день</li><li>Витамин E 400 МЕ/день</li>
              </ul>
            </div>
          </div>
        </div>
      )}







      {tab === 'pct-plan' && (
        <div>
          {pctCourse.length === 0 ? (
            <div style={s.card}>
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💊</div>
                <div style={{ fontSize: 12 }}>Курс не найден</div>
                <div style={{ fontSize: 10, marginTop: 4 }}>Добавьте препараты во вкладке Фармакология → Курс</div>
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
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Восстановление фертильности</h4>
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

      {tab === 'hrt' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ ...s.card, borderLeft:'3px solid #8b5cf6' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#8b5cf6' }}>⚕️ Гормонозаместительная терапия</h4>
            <p style={{ fontSize:10, color:'var(--text-dim)', margin:'0 0 10px', lineHeight:1.4 }}>
              Ориентировочные протоколы ТЗТ/ГЗТ, которые подлежат корректировке под конкретную ситуацию.
            </p>

            <h5 style={{ margin:'0 0 6px', fontSize:11, color:'#22c55e' }}>💉 Протоколы ТЗТ (тестостерон-заместительная терапия)</h5>
            <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
              {[
                { id:'testosterone_e', name:'Тестостерон энантат/ципионат', dose:'100-200 мг/нед', freq:'Инъекция 1 раз/нед', note:'Базовый протокол, стабильный уровень' },
                { id:'testosterone_u', name:'Тестостерон ундеканоат (Nebido)', dose:'1000 мг', freq:'Каждые 10-14 недель', note:'Длительное действие, редкие инъекции' },
                { id:'testosterone_g', name:'Тестостерон гель', dose:'50-100 мг/день', freq:'Ежедневно на кожу', note:'Физиологичные уровни, меньше колебаний' },
                { id:'hcg', name:'ХГЧ (hCG)', dose:'500 МЕ', freq:'2 раза/нед', note:'Сохранение фертильности, стимуляция Лейдигов. Схема 3/1: 3 нед приема, 1 нед отдых' },
              ].map((r, i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>{r.dose}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:2, flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:8, color:'var(--text-dim)' }}>{r.freq}</span>
                    <span style={{ fontSize:8, color:'rgba(0,230,138,0.7)', fontStyle:'italic' }}>{r.note}</span>
                  </div>
                  <div style={{ display:'flex', gap:3, marginTop:4 }}>
                    <button onClick={() => addToPlan(r.id, parseInt(r.dose) || 100, 'mg/wk', '1x/wk', 1, 12)} style={{ padding:'3px 8px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(0,230,138,0.12)', color:'#00e68a' }}>+ В план</button>
                    <button onClick={() => addToCart(r.id, r.name, r.dose)} style={{ padding:'3px 8px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒 В корзину</button>
                  </div>
                </div>
              ))}
            </div>

            <h5 style={{ margin:'0 0 6px', fontSize:11, color:'#f59e0b' }}>💊 Адъювантная терапия</h5>
            <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
              {[
                { id:'anastrozole', name:'Анастрозол', dose:'0.25-0.5 мг 2×/нед', note:'Только при E2 > 50 пг/мл + симптомы' },
                { id:'hcg', name:'ХГЧ (hCG)', dose:'500 МЕ 2×/нед', note:'При желании сохранить фертильность. Схема 3/1: 3 нед приема, 1 нед отдых' },
                { id:'l_citrulline', name:'Донаторы NO (цитруллин)', dose:'3-6 г/день', note:'Поддержка эндотелиальной функции' },
              ].map((r, i) => (
                <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#f59e0b' }}>{r.dose}</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{r.note}</div>
                  <div style={{ display:'flex', gap:3, marginTop:4 }}>
                    <button onClick={() => addToPlan(r.id, parseInt(r.dose) || 0, 'mg', '2x/wk', 1, 4)} style={{ padding:'3px 8px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(0,230,138,0.12)', color:'#00e68a' }}>+ В план</button>
                    <button onClick={() => addToCart(r.id, r.name, r.dose)} style={{ padding:'3px 8px', borderRadius:4, border:'none', cursor:'pointer', fontSize:8, fontWeight:600, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒 В корзину</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'var(--bg-primary)', borderRadius:8, padding:12, border:'1px solid var(--border)' }}>
                <h5 style={{ margin:'0 0 6px', fontSize:10, color:'#22c55e' }}>✅ Кому нужна ГЗТ</h5>
                {['Пост-курсовой гипогонадизм >6 мес','Возрастной гипогонадизм (TT <300)','Первичный гипогонадизм','Симптоматический гипогонадизм с TT <400'].map((item, i) => (
                  <div key={i} style={{ fontSize:9, color:'var(--text-light)', padding:'2px 0', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'#22c55e' }}>•</span> {item}
                  </div>
                ))}
              </div>
              <div style={{ background:'var(--bg-primary)', borderRadius:8, padding:12, border:'1px solid var(--border)' }}>
                <h5 style={{ margin:'0 0 6px', fontSize:10, color:'#ef4444' }}>🚫 Противопоказания</h5>
                {['Рак простаты (активный)','Рак молочной железы (мужчины)','Нелеченное апноэ сна','Гематокрит > 54%','Тяжёлая сердечная недостаточность'].map((item, i) => (
                  <div key={i} style={{ fontSize:9, color:'var(--text-light)', padding:'2px 0', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ color:'#ef4444' }}>×</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...s.card, borderLeft:'3px solid #ef4444' }}>
            <h4 style={{ margin:'0 0 8px', fontSize:12, color:'#ef4444' }}>⚠ Риски и мифы</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[
                { name:'Полицитемия', real:'Реальный риск: Hct > 54% — терапевтическая флеботомия или снижение дозы', myth:false },
                { name:'Апноэ сна', real:'Реальный риск: ухудшение или манифестация обструктивного апноэ сна', myth:false },
                { name:'Рак простаты', real:'Нет доказательств причинно-следственной связи. Риск прогрессии существующего рака.', myth:true },
                { name:'Сердечно-сосудистый риск', real:'Противоречивые данные. Физиологические дозы ТЗТ: нет повышения риска MACE (TRAVERSE trial, 2023)', myth:false },
              ].map((r, i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.06)', border:`1px solid ${r.myth ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)'}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    {r.myth ? <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.15)', color:'#22c55e' }}>МИФ</span> : <span style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>РЕАЛЬНО</span>}
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:3, lineHeight:1.3 }}>{r.real}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'analyses' && (
        <div>
          {/* Analyses sub-tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
            {(restrictToMode === 'pct' ? [
              { id:'before' as AnalysesSubTab, label:'До ПКТ' },
              { id:'during' as AnalysesSubTab, label:'Во время' },
              { id:'after' as AnalysesSubTab, label:'После ПКТ' },
              { id:'instrumental' as AnalysesSubTab, label:'Инструментальные' },
            ] : restrictToMode === 'hrt' ? [
              { id:'before' as AnalysesSubTab, label:'До старта' },
              { id:'during' as AnalysesSubTab, label:'Контроль (6-8 нед)' },
              { id:'after' as AnalysesSubTab, label:'Ежегодно' },
              { id:'instrumental' as AnalysesSubTab, label:'Инструментальные' },
            ] : []).map(st =>
              <button key={st.id} onClick={() => setAnalysesSTab(st.id)} style={{
                padding:'5px 10px', borderRadius:16, fontSize:9, cursor:'pointer', whiteSpace:'nowrap',
                background: analysesSTab===st.id ? 'var(--accent-green)' : 'var(--bg-secondary)',
                color: analysesSTab===st.id ? '#000' : 'var(--text-dim)', border:'none', fontWeight: analysesSTab===st.id ? 700 : 400,
              }}>{st.label}</button>
            )}
          </div>
          {(() => {
            const renderChecklist = (title: string, subtitle: string, items: {code:string;name:string;range:string}[], borderColor: string) => {
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
                          flexWrap:'wrap',
                        }}>
                          <div style={{
                            width:20, height:20, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
                            background: hasData ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.05)',
                            fontSize:12, flexShrink:0,
                          }}>{hasData ? '✓' : '○'}</div>
                          <div style={{ flex:1, minWidth: 0 }}>
                            <div style={{ fontSize:11, fontWeight: hasData ? 600 : 400, color: hasData ? 'var(--text-light)' : 'var(--text-dim)', wordBreak:'break-word' }}>
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

            if (restrictToMode === 'pct') {
              const PCT_BEFORE = [
                { code:'LH', name:'Лютеинизирующий гормон', range:'1.7-8.6 mIU/mL' },
                { code:'FSH', name:'Фолликулостимулирующий гормон', range:'1.5-12.4 mIU/mL' },
                { code:'TT', name:'Тестостерон общий', range:'300-1000 ng/dL' },
                { code:'FT', name:'Тестостерон свободный', range:'5.0-21.0 pg/mL' },
                { code:'E2', name:'Эстрадиол E2', range:'11-44 pg/mL' },
                { code:'PRL', name:'Пролактин', range:'4.0-15.2 ng/mL' },
                { code:'SHBG', name:'SHBG (ГСПГ)', range:'18-54 nmol/L' },
                { code:'TSH', name:'Тиреотропный гормон', range:'0.4-4.0 mIU/L' },
                { code:'FT4', name:'Свободный T4', range:'0.8-1.8 ng/dL' },
                { code:'CORT', name:'Кортизол (утро)', range:'6.2-19.4 mkg/dL' },
                { code:'CBC', name:'Гематокрит (Hct)', range:'<50%' },
                { code:'ALT', name:'АЛТ/AST (печень)', range:'<45/<40 U/L' },
                { code:'LIPID', name:'Липидный профиль', range:'ЛПНП<100, ЛПВП>40' },
                { code:'PSA', name:'ПСА общий', range:'<4.0 ng/mL' },
              ];
              const PCT_AFTER = [
                { code:'LH', name:'LH (контроль)', range:'1.7-8.6 mIU/mL' },
                { code:'FSH', name:'FSH (контроль)', range:'1.5-12.4 mIU/mL' },
                { code:'TT', name:'Тестостерон общий (контроль)', range:'300-1000 ng/dL' },
                { code:'FT', name:'Тестостерон свободный (контроль)', range:'5.0-21.0 pg/mL' },
                { code:'E2', name:'Эстрадиол E2 (контроль)', range:'11-44 pg/mL' },
                { code:'PRL', name:'Пролактин (контроль)', range:'4.0-15.2 ng/mL' },
                { code:'SHBG', name:'SHBG (контроль)', range:'18-54 nmol/L' },
                { code:'CBC', name:'Гематокрит (контроль)', range:'<50%' },
                { code:'ALT', name:'АЛТ/AST (контроль)', range:'<45/<40 U/L' },
                { code:'LIPID', name:'Липидный профиль (контроль)', range:'ЛПНП<100, ЛПВП>40' },
                { code:'SPERM', name:'Спермограмма', range:'Объём≥1.5мл, PR≥32%' },
              ];
              const PCT_INSTR = [
                { name:'УЗИ мошонки/яичек', purpose:'Оценка объёма яичек, исключение варикоцеле' },
                { name:'УЗИ простаты (трансректальное)', purpose:'Исключение простатита/аденомы' },
                { name:'ЭКГ', purpose:'Скрининг нарушений ритма, гипертрофии ЛЖ' },
              ];
              const PCTTimeline = () => (
                <div style={s.card}>
                  <h4 style={{ margin:'0 0 10px', fontSize:13, color:'#f59e0b', fontWeight:700 }}>⏱ Таймлайн анализов ПКТ</h4>
                  <div style={{ position:'relative', paddingLeft:20 }}>
                    <div style={{ position:'absolute', left:8, top:4, bottom:4, width:2, background:'linear-gradient(180deg, #f59e0b, #22c55e)', borderRadius:1 }} />
                    {[
                      { period:'За 7-14 дней до последней инъекции', label:'До ПКТ', color:'#f59e0b', items:'Полный гормональный профиль + CBC + биохимия + ПСА' },
                      { period:'Недели 1-2', label:'Старт ПКТ', color:'#ec4899', items:'LH, FSH, TT — контроль базы' },
                      { period:'Недели 3-4', label:'Первичный контроль', color:'#a855f7', items:'LH, FSH, TT, E2, PRL — каждые 2 нед' },
                      { period:'Недели 5-8', label:'Коррекция', color:'#3b82f6', items:'LH, FSH, TT, E2, Hct, ALT — каждые 2 нед' },
                      { period:'Через 4-6 нед после ПКТ', label:'Финальный контроль', color:'#22c55e', items:'Все маркеры + спермограмма + DFI + ингибин B' },
                    ].map((item, i) => (
                      <div key={i} style={{ position:'relative', marginBottom:10, paddingLeft:12, borderLeft:`2px solid ${item.color}` }}>
                        <div style={{ position:'absolute', left:-17, top:2, width:10, height:10, borderRadius:'50%', background:item.color }} />
                        <div style={{ fontSize:8, color:item.color, fontWeight:700, letterSpacing:'0.5px' }}>{item.label}</div>
                        <div style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{item.period}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{item.items}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              const PCT_DURING = [
                { code:'LH', name:'LH (контроль каждые 2 нед)', range:'1.7-8.6 mIU/mL' },
                { code:'FSH', name:'FSH (контроль каждые 2 нед)', range:'1.5-12.4 mIU/mL' },
                { code:'TT', name:'Тестостерон общий', range:'300-1000 ng/dL' },
                { code:'FT', name:'Тестостерон свободный', range:'5.0-21.0 pg/mL' },
                { code:'E2', name:'Эстрадиол E2', range:'11-44 pg/mL' },
                { code:'PRL', name:'Пролактин', range:'4.0-15.2 ng/mL' },
                { code:'CBC', name:'Гематокрит (Hct)', range:'<50%' },
                { code:'ALT', name:'АЛТ/AST (печень)', range:'<45/<40 U/L' },
              ];
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {analysesSTab === 'before' && renderChecklist('До ПКТ', 'Обязательный минимум перед стартом', PCT_BEFORE, '#f59e0b')}
                  {analysesSTab === 'during' && renderChecklist('Во время ПКТ', 'Контроль каждые 2 нед', PCT_DURING, '#a855f7')}
                  {analysesSTab === 'after' && renderChecklist('После ПКТ (4-6 нед)', 'Контроль восстановления', PCT_AFTER, '#22c55e')}
                  {analysesSTab === 'instrumental' && (
                    <div style={{ ...s.card, borderLeft:'3px solid #a855f7' }}>
                      <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#a855f7' }}>🔬 Инструментальные исследования ПКТ</h4>
                      {PCT_INSTR.map((e,i) => (
                        <div key={i} style={{ padding:'4px 0', fontSize:10, color:'var(--text-dim)' }}><b>{e.name}</b> — {e.purpose}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (restrictToMode === 'hrt') {
              const HRT_BASELINE = [
                { code:'TT', name:'Тестостерон общий', range:'300-1000 ng/dL' },
                { code:'FT', name:'Тестостерон свободный', range:'5.0-21.0 pg/mL' },
                { code:'E2', name:'Эстрадиол E2', range:'11-44 pg/mL' },
                { code:'SHBG', name:'SHBG (ГСПГ)', range:'18-54 nmol/L' },
                { code:'LH', name:'Лютеинизирующий гормон', range:'1.7-8.6 mIU/mL' },
                { code:'FSH', name:'Фолликулостимулирующий гормон', range:'1.5-12.4 mIU/mL' },
                { code:'PRL', name:'Пролактин', range:'4.0-15.2 ng/mL' },
                { code:'CBC', name:'Гематокрит (Hct)', range:'<50%' },
                { code:'TSH', name:'Тиреотропный гормон', range:'0.4-4.0 mIU/L' },
                { code:'LIPID', name:'Липидный профиль', range:'ЛПНП<100, ЛПВП>40' },
                { code:'PSA', name:'ПСА общий', range:'<4.0 ng/mL' },
                { code:'INHB', name:'Ингибин B', range:'>80 pg/mL' },
                { code:'VITD', name:'25-OH Витамин D', range:'30-100 ng/mL' },
              ];
              const HRT_DURING = [
                { code:'TT', name:'Тестостерон общий (пик/надир)', range:'500-900 ng/dL' },
                { code:'FT', name:'Тестостерон свободный', range:'15-25 pg/mL' },
                { code:'E2', name:'Эстрадиол E2', range:'20-40 pg/mL' },
                { code:'CBC', name:'Гематокрит', range:'<50%' },
                { code:'PSA', name:'ПСА', range:'<4.0 ng/mL' },
                { code:'LIPID', name:'Липиды', range:'ЛПНП<100, ЛПВП>40' },
              ];
              const HRT_FOLLOWUP = [
                { code:'TT', name:'Тестостерон (плато)', range:'500-900 ng/dL' },
                { code:'FT', name:'Свободный тестостерон', range:'15-25 pg/mL' },
                { code:'E2', name:'Эстрадиол', range:'20-40 pg/mL' },
                { code:'CBC', name:'Гематокрит', range:'<50%' },
                { code:'PSA', name:'ПСА', range:'<4.0 ng/mL' },
                { code:'LIPID', name:'Липидный профиль', range:'ЛПНП<100, ЛПВП>40' },
                { code:'DEXA', name:'Денситометрия (DEXA)', range:'Z-score > -1.5' },
              ];
              const HRT_INSTR = [
                { name:'УЗИ простаты (трансректальное)', purpose:'Оценка объёма, исключение узлов/РПЖ (базово + ежегодно)' },
                { name:'Денситометрия DEXA', purpose:'МПК при длительной ГЗТ >2 лет (каждые 1-2 года)' },
                { name:'Эхокардиография', purpose:'Скрининг гипертрофии ЛЖ (базово, затем по показаниям)' },
                { name:'УЗИ мошонки', purpose:'Исключение варикоцеле, оценка яичек (базово)' },
              ];
              const HRTTimeline = () => (
                <div style={s.card}>
                  <h4 style={{ margin:'0 0 10px', fontSize:13, color:'#8b5cf6', fontWeight:700 }}>⏱ Таймлайн анализов ГЗТ</h4>
                  <div style={{ position:'relative', paddingLeft:20 }}>
                    <div style={{ position:'absolute', left:8, top:4, bottom:4, width:2, background:'linear-gradient(180deg, #8b5cf6, #22c55e)', borderRadius:1 }} />
                    {[
                      { period:'До старта (за 1-2 нед)', label:'Базовый', color:'#8b5cf6', items:'TT, FT, SHBG, ЛГ, ФСГ, E2, PRL, ПСА, Hct, липиды, HOMA-IR, DEXA' },
                      { period:'Через 6-8 нед', label:'Коррекция дозы', color:'#60a5fa', items:'TT/FT/E2 на пике и надире, Hct, ПСА' },
                      { period:'Каждые 3-6 мес', label:'Плановый', color:'#06b6d4', items:'TT, FT, E2, Hct, ПСА, липиды, HOMA-IR' },
                      { period:'Ежегодно', label:'Полный чек-ап', color:'#22c55e', items:'Гормоны + DEXA + УЗИ простаты + ЭхоКГ' },
                    ].map((item, i) => (
                      <div key={i} style={{ position:'relative', marginBottom:10, paddingLeft:12, borderLeft:`2px solid ${item.color}` }}>
                        <div style={{ position:'absolute', left:-17, top:2, width:10, height:10, borderRadius:'50%', background:item.color }} />
                        <div style={{ fontSize:8, color:item.color, fontWeight:700, letterSpacing:'0.5px' }}>{item.label}</div>
                        <div style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{item.period}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{item.items}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {analysesSTab === 'before' && renderChecklist('Базовые анализы (до старта ГЗТ)', 'Исходный профиль', HRT_BASELINE, '#8b5cf6')}
                  {analysesSTab === 'during' && renderChecklist('Контроль на терапии (6-8 нед)', 'Пик/надир + Hct', HRT_DURING, '#60a5fa')}
                  {analysesSTab === 'after' && renderChecklist('Ежегодный мониторинг', 'Плато + скрининг', HRT_FOLLOWUP, '#22c55e')}
                  {analysesSTab === 'instrumental' && (
                    <div style={{ ...s.card, borderLeft:'3px solid #a855f7' }}>
                      <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#a855f7' }}>🔬 Инструментальные исследования ГЗТ</h4>
                      {HRT_INSTR.map((e,i) => (
                        <div key={i} style={{ padding:'4px 0', fontSize:10, color:'var(--text-dim)' }}><b>{e.name}</b> — {e.purpose}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (restrictToMode === 'fertility' || !restrictToMode) {
              const FERT_LABS = [
                { code:'INHB', name:'Ингибин B', range:'>80 pg/mL' },
                { code:'AMH', name:'АМГ (анти-Мюллеров гормон)', range:'>2.0 ng/mL' },
                { code:'LH', name:'Лютеинизирующий гормон', range:'1.7-8.6 mIU/mL' },
                { code:'FSH', name:'Фолликулостимулирующий гормон', range:'1.5-12.4 mIU/mL' },
                { code:'TT', name:'Тестостерон общий', range:'300-1000 ng/dL' },
                { code:'FT', name:'Тестостерон свободный', range:'5.0-21.0 pg/mL' },
                { code:'E2', name:'Эстрадиол E2', range:'11-44 pg/mL' },
                { code:'PRL', name:'Пролактин', range:'4.0-15.2 ng/mL' },
                { code:'SHBG', name:'SHBG (ГСПГ)', range:'18-54 nmol/L' },
              ];
              const FERT_SPERM = [
                { code:'SPERM_VOL', name:'Объём эякулята', range:'≥1.5 мл' },
                { code:'SPERM_CONC', name:'Концентрация сперматозоидов', range:'≥15 млн/мл' },
                { code:'SPERM_PR', name:'Прогрессивно-подвижные (PR)', range:'≥32%' },
                { code:'SPERM_NP', name:'Непрогрессивно-подвижные (NP)', range:'—' },
                { code:'SPERM_MORPH', name:'Морфология (строгие критерии Крюгера)', range:'≥4%' },
                { code:'SPERM_MAR', name:'MAR-тест (антиспермальные антитела)', range:'<50%' },
                { code:'SPERM_DFI', name:'DFI (фрагментация ДНК)', range:'<15%' },
                { code:'SPERM_VIT', name:'Жизнеспособность', range:'≥58%' },
              ];
              const FERT_PERIODS = [
                { name:'Ингибин B + АМГ', period:'базово + каждые 3-6 мес восстановления', note:'Ключевые маркеры сперматогенеза и овариального резерва' },
                { name:'Гормональный профиль', period:'базово + каждые 4-6 нед на фоне терапии', note:'LH, FSH, TT, FT, E2, PRL, SHBG' },
                { name:'Спермограмма', period:'базово, затем через 3 и 6 мес восстановления', note:'Полный анализ + MAR + DFI' },
              ];
              const FertTimeline = () => (
                <div style={s.card}>
                  <h4 style={{ margin:'0 0 10px', fontSize:13, color:'#3b82f6', fontWeight:700 }}>⏱ Таймлайн анализов фертильности</h4>
                  <div style={{ position:'relative', paddingLeft:20 }}>
                    <div style={{ position:'absolute', left:8, top:4, bottom:4, width:2, background:'linear-gradient(180deg, #3b82f6, #22c55e)', borderRadius:1 }} />
                    {[
                      { period:'До старта терапии (базово)', label:'Базовые маркеры', color:'#3b82f6', items:'Ингибин B, АМГ, LH, FSH, TT, FT, E2, PRL, SHBG' },
                      { period:'Каждые 4-6 нед на фоне терапии', label:'Контроль динамики', color:'#60a5fa', items:'LH, FSH, TT, FT, E2, PRL, SHBG' },
                      { period:'Базово + через 3 и 6 мес', label:'Спермограмма', color:'#06b6d4', items:'Полный анализ + MAR-тест + DFI + жизнеспособность' },
                      { period:'Каждые 3-6 мес восстановления', label:'Ингибин B + АМГ', color:'#22c55e', items:'Оценка сперматогенеза и овариального резерва' },
                    ].map((item, i) => (
                      <div key={i} style={{ position:'relative', marginBottom:10, paddingLeft:12, borderLeft:`2px solid ${item.color}` }}>
                        <div style={{ position:'absolute', left:-17, top:2, width:10, height:10, borderRadius:'50%', background:item.color }} />
                        <div style={{ fontSize:8, color:item.color, fontWeight:700, letterSpacing:'0.5px' }}>{item.label}</div>
                        <div style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{item.period}</div>
                        <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{item.items}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              return (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* 1. Гормоны */}
                  <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid rgba(59,130,246,0.2)' }}>
                    <div style={{ padding:'8px 12px', background:'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(99,102,241,0.06))', borderBottom:'1px solid rgba(59,130,246,0.1)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:16 }}>🧬</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#3b82f6' }}>Гормоны крови</span>
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginLeft:'auto' }}>10 маркеров</span>
                      </div>
                    </div>
                    <div style={{ padding:12, background:'rgba(24,24,27,0.12)' }}>
                      <p style={{ fontSize:9, color:'rgba(255,255,255,0.5)', margin:'0 0 8px' }}>Автозаполнение из LabsScreen</p>
                      <div style={s.row}>
                        <div>{field('LH (mIU/mL)', lh, setLh, '5')}</div>
                        <div>{field('FSH (mIU/mL)', fsh, setFsh, '4')}</div>
                      </div>
                      <div style={s.row}>
                        <div>{field('TT общ. (ng/dL)', tt, setTt, '500')}</div>
                        <div>{field('FT своб. (pg/mL)', ft, setFt, '15')}</div>
                      </div>
                      <div style={s.row}>
                        <div>{field('E2 (pg/mL)', e2, setE2, '25')}</div>
                        <div>{field('Пролактин (ng/mL)', prl, setPrl, '8')}</div>
                      </div>
                      <div style={s.row}>
                        <div>{field('SHBG (nmol/L)', shbg, setShbg, '30')}</div>
                        <div>{field('Ингибин B (pg/mL)', inhb, setInhb, '150')}</div>
                      </div>
                      <div style={s.row}>
                        <div>{field('AMH (ng/mL)', amh, setAmh, '4')}</div>
                        <div></div>
                      </div>
                    </div>
                  </div>
                  {renderChecklist('Гормональные маркеры фертильности', 'Базовые и контрольные', FERT_LABS, '#3b82f6')}

                  {/* 2. Спермограмма — display-only */}
                  <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ padding:'8px 12px', background:'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(22,163,74,0.06))', borderBottom:'1px solid rgba(34,197,94,0.1)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:16 }}>🔬</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#22c55e' }}>Спермограмма</span>
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginLeft:'auto' }}>ВОЗ 2021</span>
                      </div>
                    </div>
                    <div style={{ padding:12, background:'rgba(24,24,27,0.12)' }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {[
                          { label:'📦 Объём', val:volume, norm:'≥1.5 мл', good:(v:any)=>parseFloat(v||'0')>=1.5 },
                          { label:'🔬 Концентрация', val:concentration, norm:'≥16 млн/мл', good:(v:any)=>parseFloat(v||'0')>=16 },
                          { label:'📊 Общее кол-во', val:totalCount, norm:'≥39 млн', good:(v:any)=>parseFloat(v||'0')>=39 },
                          { label:'🏃 PR подвижность', val:pr, norm:'≥30%', good:(v:any)=>parseFloat(v||'0')>=30 },
                          { label:'🚶 NP подвижность', val:np, norm:'—', good:()=>true },
                          { label:'🛑 Неподвижные', val:immotile, norm:'—', good:()=>true },
                          { label:'🧬 Морфология', val:morphology, norm:'≥4%', good:(v:any)=>parseFloat(v||'0')>=4 },
                          { label:'💪 Жизнеспособность', val:viability, norm:'≥58%', good:(v:any)=>parseFloat(v||'0')>=58 },
                          { label:'🧪 pH', val:ph, norm:'7.2–8.0', good:(v:any)=>{const n=parseFloat(v||'7.4'); return n>=7.2&&n<=8.0} },
                          { label:'🍬 Фруктоза', val:fructose, norm:'≥13 ммоль/л', good:()=>true },
                          { label:'⚡ Цинк', val:zincMmol, norm:'≥2 ммоль/л', good:()=>true },
                          { label:'🛡 MAR-тест', val:mar, norm:'<50%', good:(v:any)=>parseFloat(v||'0')<50 },
                          { label:'🔴 Лейкоциты', val:leukocytes, norm:'<1 млн/мл', good:(v:any)=>parseFloat(v||'0')<1 },
                        ].map((item, i) => {
                          const isGood = item.good(item.val||'0');
                          return (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:6, background:i%2===0?'rgba(34,197,94,0.04)':'transparent' }}>
                              <span style={{ fontSize:9, fontWeight:600, color:'var(--text-light)' }}>{item.label}</span>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ fontSize:9, color:item.val?(isGood?'#22c55e':'#ef4444'):'var(--text-dim)', fontWeight:item.val?700:400 }}>
                                  {item.val || '—'}
                                </span>
                                <span style={{ fontSize:8, color:'var(--text-dim)' }}>{item.norm}</span>
                                {item.val && <span style={{ fontSize:10 }}>{isGood ? '✅' : '❌'}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display:'flex', gap:12, padding:'5px 8px', fontSize:9, color:'var(--text-dim)' }}>
                        <span>Вязкость: {viscosity ? '⚠ Повышена' : '✅ Норма'}</span>
                        <span>Агглютинация: {agglutination ? '❌ Есть' : '✅ Нет'}</span>
                      </div>
                    </div>
                  </div>
                  {renderChecklist('Спермограмма + MAR + DFI', 'Полная оценка сперматогенеза', FERT_SPERM, '#22c55e')}

                  {/* 3. DFI/Структура */}
                  <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid rgba(168,85,247,0.2)' }}>
                    <div style={{ padding:'8px 12px', background:'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(139,92,246,0.06))', borderBottom:'1px solid rgba(168,85,247,0.1)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:16 }}>🧬</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#a855f7' }}>DFI и структурные факторы</span>
                        <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginLeft:'auto' }}>Фрагментация ДНК</span>
                      </div>
                    </div>
                    <div style={{ padding:12, background:'rgba(24,24,27,0.12)' }}>
                      <div style={s.row}>
                        <div>{field('DFI (%) <=15 норма', dfi, setDfi, '0')}</div>
                        <div>
                          <span style={s.label}>Варикоцеле</span>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            {VARICOCELE.map(v => <button key={v.id} style={varicocele === v.id ? s.btnActive : s.btn} onClick={() => setVaricocele(v.id)}>{v.label}</button>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Периоды сдачи */}
                  <FertTimeline />

                  {/* 5. Инструментальные */}
                  <div style={s.card}>
                    <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#a855f7' }}>🔬 Инструментальные исследования фертильности</h4>
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {[
                        { name:'УЗИ мошонки с допплером', purpose:'Кровоток яичек, варикоцеле, объём яичек' },
                        { name:'Спермограмма + MAR-тест', purpose:'Количество, подвижность, морфология, антиспермальные антитела' },
                        { name:'Фрагментация ДНК (SCD/Halosperm)', purpose:'Целостность хроматина, DFI < 15%' },
                        { name:'УЗИ простаты (трансректальное)', purpose:'Исключение инфекции/воспаления' },
                        { name:'Гормональный профиль (кровь)', purpose:'ЛГ, ФСГ, ТТ, E2, Пролактин, Ингибин В, АМГ' },
                      ].map((e, i) => (
                        <div key={i} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(168,85,247,0.04)', border:'1px solid rgba(168,85,247,0.08)' }}>
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{e.name}</span>
                          <span style={{ fontSize:9, color:'var(--text-dim)', marginLeft:4 }}>— {e.purpose}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })()}
        </div>
      )}

      {/* === APPENDED GUIDE CONTENT: PCT === */}
      {tab === 'pct-plan' && restrictToMode === 'pct' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={s.card}>
            <h4 style={{ margin:'0 0 6px', fontSize:14, color:'#8b5cf6' }}>🔄 Ориентировочный протокол ПКТ и нейроэндокринной реабилитации</h4>
                <p style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.5, margin:0 }}>
                  Послекурсовая терапия (ПКТ) направлена на восстановление гипоталамо-гипофизарно-тестикулярной оси (HPTA) после подавления экзогенными андрогенами. Мозг является главным регулятором фертильности — нейротоксичность ААС затрагивает глутаматную эксайтотоксичность, окислительный стресс, нейровоспаление, подавление нейрогенеза и нейростероидную недостаточность. Восстановление оси занимает 6-20+ недель в зависимости от стажа, соединений и возраста.
                </p>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#f59e0b' }}>🧠 Нейроанатомия репродуктивной оси</h4>
                <div style={{ fontSize:10, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>GnRH-нейроны</b> — главные регуляторы HPTA. ААС подавляют их через андрогеновые рецепторы и нейростероидную модуляцию GABA-A.<br/><br/>
                  <b>Кисспептин (KNDy-нейроны)</b> — критические активаторы GnRH. Тренболон и нандролон разрушают кисспептиновую сигнализацию, блокируя половое поведение и пульсаторную секрецию ЛГ.<br/><br/>
                  <b>GABA-эргическая система</b> — нейростероиды (аллопрегнанолон) модулируют GABA-A рецепторы, вызывая депрессию, тревожность и подавление GnRH-импульсов.
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>💊 Фармакологические протоколы ПКТ</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <div style={{ padding:'8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#22c55e' }}>🔹 СЕРМ-терапия</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>
                       <b>Энкломифен 25 мг/день</b> (6-8 нед) — чистый изомер, меньше побочек. ИЛИ <b>Кломифен 50 мг/день</b> (2 нед) → <b>Тамоксифен 20 мг/день</b> (4-6 нед). Цель: ЛГ/ФСГ {'>'}5, TT {'>'}15 нмоль/л.
                    </div>
                  </div>
                  <div style={{ padding:'8px', borderRadius:6, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#8b5cf6' }}>🔹 hCG + hMG (комбинированная стимуляция)</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>
                      hCG 500 МЕ 2р/нед, 3/1 × 2-3 нед → затем СЕРМ. При азооспермии: hMG 75-150 МЕ/день (3-6 мес) — золотой стандарт.
                    </div>
                  </div>
                  <div style={{ padding:'8px', borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#ef4444' }}>🚫 Запрещено на ПКТ</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>
                      Финастерид/дутастерид, НПВС, опиоиды, GABA-агонисты, алкоголь, THC, рацетамы — все подавляют ось HPTA и блокируют восстановление.
                    </div>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#3b82f6' }}>🧬 Нутрицевтическая поддержка ПКТ</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  {[
                    { name:'CoQ10', dose:'200-600 мг' },
                    { name:'L-карнитин', dose:'2-3 г' },
                    { name:'Цинк + Медь', dose:'30-50 мг + 2 мг' },
                    { name:'Селен', dose:'200 мкг' },
                    { name:'Витамин D3', dose:'4000-5000 МЕ' },
                    { name:'Омега-3', dose:'3-5 г' },
                    { name:'NAC', dose:'1200 мг' },
                    { name:'TUDCA', dose:'500-1000 мг' },
                    { name:'Магний треонат', dose:'2 г' },
                    { name:'Ашваганда', dose:'600 мг' },
                    { name:'Maca', dose:'3-5 г' },
                    { name:'Кордицепс', dose:'2-3 г' },
                  ].map((item, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 6px', borderRadius:4, background:i%2===0 ? 'rgba(0,0,0,0.03)' : 'transparent' }}>
                      <span>{item.name} <span style={{ color:'#60a5fa' }}>{item.dose}</span></span>
                      <div style={{ display:'flex', gap:3 }}>
                        <button onClick={() => addToCart(`su_${item.name}`, item.name, item.dose)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:7, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ec4899' }}>🧠 Нейропротективное ядро ПКТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>GlyNAC</b> (глицин+NAC) 1200 мг — предшественник глутатиона, защита нейронов.<br/>
                  <b>Alpha-GPC + Уридин</b> — синергия для восстановления дофаминовых нейронов.<br/>
                  <b>Лития ороат 5-20 мг</b> — активатор BDNF, стимуляция нейрогенеза в гиппокампе.<br/>
                  <b>Бромантан 50-100 мг/день</b> — дофаминергический адаптоген, восстановление мотивации.<br/>
                  <b>PQQ 20-40 мг/день</b> — биогенез митохондрий, защита GnRH-нейронов.
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#f59e0b' }}>⏱ Пошаговый план ПКТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.6 }}>
                  <b>Подготовка (нед -2–0):</b> сдать анализы, отменить все ААС, начать нутрицевтическую поддержку<br/>
                  <b>Фаза 1 (нед 1-2):</b> hCG 500 МЕ 2р/нед, 3/1 + нутрицевтическая база<br/>
                  <b>Фаза 2 (нед 3-8):</b> Энкломифен 25 мг/день + нейропротективное ядро<br/>
                  <b>Стабилизация (нед 9-20):</b> контроль анализов, коррекция доз, переход на ТЗТ при необходимости<br/>
                  <b>Контроль:</b> анализы на 2, 4, 6, 8, 12, 20 неделях
                </div>
              </div>

              {/* === PCT ADDITIONS START === */}

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#06b6d4' }}>🩸 Лабораторный мониторинг ПКТ</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>Ингибин B</span><span style={{ fontWeight:600, color:'#22c55e' }}>{'>'}80 pg/mL — клетки Сертоли</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>Спермограмма</span><span style={{ fontWeight:600, color:'#22c55e' }}>концентрация ≥15 млн/мл, подвижность ≥40%</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>ЛГ / ФСГ</span><span style={{ fontWeight:600, color:'#f59e0b' }}>цель {">"}5 МЕ/л к 8 нед</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>Тестостерон общий</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥15 нмоль/л (432 нг/дл)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>Э2 (эстрадиол)</span><span style={{ fontWeight:600, color:'#f59e0b' }}>20-40 пг/мл</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>Пролактин</span><span style={{ fontWeight:600, color:'#ef4444' }}>{'<'}15 нг/мл (выше → дофамин)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>Цистатин C</span><span style={{ fontWeight:600, color:'#06b6d4' }}>0.6-1.0 мг/л — нефропротекция</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Контроль на 2, 4, 6, 8, 12, 20 неделях. При ингибине B {'<'}80 → hMG 75-150 МЕ/день</div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>🥗 Подробная нутрицевтическая поддержка</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  {[
                    { n:'CoQ10 (убихинон)', d:'200-400 мг/день' },
                    { n:'L-карнитин + ALCAR', d:'2-3 г/день' },
                    { n:'Цинк (пиколинат/цитрат) + Медь', d:'30-50 мг/день + 2 мг' },
                    { n:'Селен (L-селенометионин)', d:'200 мкг/день' },
                    { n:'Витамин D3', d:'3000-5000 МЕ/день' },
                    { n:'Омега-3 (ЭПК+ДГК)', d:'2-4 г/день' },
                    { n:'Магний (треонат/глицинат)', d:'2-3 г/день' },
                    { n:'Фолиевая кислота (5-MTHF)', d:'400-800 мкг/день' },
                    { n:'Витамин E (токоферолы)', d:'400-800 МЕ/день' },
                    { n:'Витамин C', d:'1-2 г/день' },
                  ].map((it, idx) => (
                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 6px', borderRadius:4, background:idx%2===0 ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
                      <span style={{ flex:1 }}>{it.n}</span>
                      <span style={{ fontWeight:600, color:'#22c55e', marginRight:4 }}>{it.d}</span>
                      <button onClick={() => addToCart(`su_pct_${it.n}`, it.n, it.d)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:7, background:'rgba(245,158,11,0.12)', color:'#f59e0b', flexShrink:0 }}>🛒</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ef4444' }}>🛡 Органопротекция на ПКТ</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:5, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  {[
                    { color:'#ef4444', label:'Гепатопротекция', items:[
                      { id:'nac', name:'NAC', dose:'1200-1800 мг/день' },
                      { id:'tudca', name:'TUDCA', dose:'500-1000 мг/день' },
                      { id:'silymarin', name:'Силимарин', dose:'300-600 мг/день' },
                    ]},
                    { color:'#60a5fa', label:'Кардиопротекция', items:[
                      { id:'berberine', name:'Берберин', dose:'500 мг 2-3 р/день' },
                      { id:'quercetin', name:'Кверцетин', dose:'500 мг/день' },
                      { id:'omega3', name:'Омега-3', dose:'3-5 г' },
                      { id:'astaxanthin', name:'Астаксантин', dose:'12 мг/день' },
                    ]},
                    { color:'#06b6d4', label:'Нефропротекция', items:[
                      { id:'water', name:'Гидратация', dose:'2.5-3 л/день' },
                      { id:'quercetin_kidney', name:'Кверцетин (↓ TGF-β1)', dose:'500 мг' },
                    ]},
                  ].map((section, si) => (
                    <div key={si} style={{ padding:'6px 8px', borderRadius:6, background:'rgba('+(si===0?'239,68,68':si===1?'59,130,246':'6,182,212')+',0.05)', border:'1px solid rgba('+(si===0?'239,68,68':si===1?'59,130,246':'6,182,212')+',0.1)' }}>
                      <div style={{ fontWeight:600, color:section.color, marginBottom:2, fontSize:10 }}>{section.label}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                        {section.items.map((it, i) => (
                          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 6px', borderRadius:4, background:'rgba(255,255,255,0.05)' }}>
                            {it.name} {it.dose}
                            <button onClick={() => addToCart(`su_prot_${it.id}`, it.name, it.dose)} style={{ padding:'1px 4px', borderRadius:3, border:'none', cursor:'pointer', fontSize:6, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>🛒</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#8b5cf6' }}>📖 Клинические кейсы ПКТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Кейс 1</b> (Fertil Steril 2003): 38 лет, азооспермия после 5 лет ААС. hCG 500 МЕ 2р/нед, 3/1 4 нед → hMG 150 МЕ/день 6 мес. Спермограмма: 38 млн, подвижность 45%. Зачатие через 7 мес.<br/><br/>
                  <b>Кейс 2</b> (Ibis 2025, n=47): кломифен 50 мг/день + ХГЧ 500 МЕ 2р/нед (1000 МЕ/нед), 3/1 12 нед. Восстановление сперматогенеза у 87.5% пациентов. Среднее время: 4.2 мес.<br/><br/>
                  <b>Кейс 3</b> (форум, подтверждён): 27 лет, 2 года тренболон+тестостерон. TT {'<'}50 нг/дл, ЛГ {'<'}0.1. Энкломифен 25 мг 12 нед + кисспептин 0.5 мкг/кг × 3 мес. TT 580, ЛГ 4.2. Субъективно: «нейроэндокринное похмелье» купировано к 6 нед.
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#f59e0b' }}>❓ FAQ: ПКТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>1. Как долго восстанавливается ось?</b> 6-20+ недель. Зависит от стажа, соединений (тренболон → дольше), возраста. После 35 лет — на 30% дольше.<br/><br/>
                  <b>2. Стану ли я бесплодным после ААС?</b> У 70-80% полное восстановление сперматогенеза. Риск необратимости: стаж {">"}3 лет непрерывно, ААС до 20 лет, тренболон/нандролон в высоких дозах.<br/><br/>
                  <b>3. Энкломифен vs кломифен?</b> Энкломифен — чистый изомер (zu-кломифен). Меньше побочек (нет блокады эстрогена в ЦНС), выше эффективность. Кломифен — рацемическая смесь, больше побочных.<br/><br/>
                  <b>4. Можно ли креатин и протеин?</b> Да. Креатин — до 5 г/день безопасен. Сывороточный протеин — полезен для восстановления. Соевый протеин — ограничить (фитоэстрогены).<br/><br/>
                  <b>5. ТЗТ + фертильность?</b> Возможно: ТЗТ + hCG 500 МЕ 2р/нед, 3/1. Либо альтернатива: энкломифен 12.5 мг/день монотерапия (без ТЗТ).
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ec4899' }}>😌 Психологические аспекты ПКТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Гормональные качели:</b> резкое падение андрогенов в первые 2-4 нед ПКТ → депрессия, тревожность, апатия. Нейростероиды (аллопрегнанолон) падают вместе с тестостероном → GABA-A дефицит.<br/><br/>
                  <b>Стресс → кортизол → подавление оси:</b> хронический стресс повышает кортизол → ингибирует GnRH через CRH/AVP → замедляет восстановление. Рекомендуется: адаптогены (ашваганда 600 мг, родиола 300 мг), КПТ, снижение нагрузок, сон ≥8ч.<br/><br/>
                  <b>Поддержка:</b> группы восстановления, психотерапия, дневник симптомов. Важно: не принимать решений в первые 6 нед ПКТ — когнитивные функции восстанавливаются позже гормонов.
                </div>
              </div>

              {/* === PCT ADDITIONS END === */}
          </div>
        )}

        {/* === APPENDED GUIDE CONTENT: HRT === */}
        {tab === 'hrt' && restrictToMode === 'hrt' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={s.card}>
              <h4 style={{ margin:'0 0 6px', fontSize:14, color:'#8b5cf6' }}>⚕️ Ориентировочный протокол</h4>
                <p style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.5, margin:0 }}>
                  Гормонозаместительная терапия тестостероном (ТЗТ/ГЗТ) — стандарт лечения гипогонадизма различной этиологии. Эпидемиология: гипогонадизм встречается у 20-30% мужчин с ожирением, 25-40% при диабете 2 типа, 30-50% мужчин {'>'}70 лет. TRAVERSE trial (NEJM 2023) не выявил повышения MACE при физиологических дозах ТЗТ.
                </p>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>💉 Клинические протоколы</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#00e68a' }}>Классическая ТЗТ</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}>Тестостерон энантат/ципионат 100-200 мг/нед. Цель: TT 500-900 нг/дл, FT 15-25 пг/мл. Контроль E2 каждые 3 мес.</div>
                  </div>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#60a5fa' }}>Сохранение фертильности</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}>ТЗТ + hCG 500 МЕ 2р/нед, 3/1. hCG поддерживает интратестикулярный тестостерон и объём яичек.</div>
                  </div>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.04)', border:'1px solid rgba(245,158,11,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#f59e0b' }}>T4DM — ожирение/предиабет</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}>ТЗТ + образ жизни. Цель: снижение веса, HbA1c, висцерального жира. Контроль апноэ сна.</div>
                  </div>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#ef4444' }}>Коррекция E2</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.3 }}>Анастрозол 0.25-0.5 мг 2×/нед только при E2 {'>'}50 пг/мл + симптомы. Ингибиторы ароматазы не рутина.</div>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ef4444' }}>⚠ Лекарственные взаимодействия</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>ТЗТ + антикоагулянты:</b> усиление эффекта варфарина — контроль MHO каждые 2 нед первые 3 мес<br/>
                  <b>ТЗТ + опиоиды:</b> опиоиды подавляют GnRH — может потребоваться ↑ дозы<br/>
                  <b>ТЗТ + ингибиторы 5α-редуктазы:</b> финастерид ↓ ДГТ, может ↑ эстрогенов — контроль E2<br/>
                  <b>ТЗТ + СИОЗС:</b> СИОЗС могут ↓ тестостерон через пролактин — контроль PRL<br/>
                  <b>ТЗТ + статины:</b> статины ↓ ЛПНП, но могут ↓ ЛГ — контроль гормонов
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#f59e0b' }}>📋 15 частых ошибок ГЗТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  1. Старт без базовых анализов · 2. Недостаточная частота инъекций · 3. Игнорирование E2 · 4. Пропуск Hct · 5. ТЗТ при нелеченном апноэ сна<br/>
                  6. Отсутствие hCG при желании фертильности · 7. Избыточная ароматазная блокада · 8. Старт TT{'<'}300 без симптомов · 9. Пропуск DEXA · 10. Игнорирование липидов<br/>
                  11. Комбинация с финастеридом без контроля · 12. ТЗТ при активном РПЖ · 13. Одновременный приём опиоидов · 14. Без контроля PRL · 15. Резкая отмена без моста
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#3b82f6' }}>📖 Клинические случаи (5 из 25)</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>1.</b> 34 года, пост-курсовой гипогонадизм 8 мес: TT 180, LH 1.2. Энкломифен 25 мг 8 нед → TT 580, ЛГ 4.8. Симптомы купированы.<br/>
                  <b>2.</b> 52 года, возрастной гипогонадизм: TT 280, симптомы. ТЗТ энантат 150 мг/нед → TT 720, Hct 48%. Контроль E2 анастрозолом.<br/>
                  <b>3.</b> 28 лет, фертильность после курса: hCG 500 МЕ 2р/нед, 3/1 3 нед → энкломифен 25 мг 8 нед + hMG 75 МЕ × 3 мес. Спермограмма восстановлена.<br/>
                  <b>4.</b> 45 лет, метаболический синдром + TT 310: ТЗТ ципионат 100 мг/нед + диета. Через 6 мес: −8 кг, HbA1c 5.7%, TT 650.<br/>
                  <b>5.</b> 60 лет, TT 150, ожирение, апноэ сна: СРАР-терапия 3 мес → затем ТЗТ ундеканоат. TT 550, симптомы улучшились.
                </div>
              </div>

              {/* === HRT ADDITIONS START === */}

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#f59e0b' }}>📋 Шкала ADAM для диагностики гипогонадизма</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Androgen Deficiency in the Aging Male (ADAM):</b> 10 вопросов. ≥3 ответов «Да» → лабораторное подтверждение.<br/><br/>
                  <div>1. Снижение либидо? · 2. Недостаток энергии? · 3. Снижение мышечной силы? · 4. Увеличение веса? · 5. Снижение качества эрекции?<br/>
                  6. Ухудшение спортивных результатов? · 7. Сонливость после еды? · 8. Снижение работоспособности? · 9. Депрессивность? · 10. Проблемы с концентрацией?</div>
                  <div style={{ marginTop:4, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.1)' }}>
                    <b>Важно:</b> ADAM — скрининг, не диагноз. Чувствительность 88%, специфичность 60%. Подтверждение: TT {'<'}300 нг/дл + симптомы.
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#06b6d4' }}>🧪 Лабораторный минимум перед стартом ГЗТ</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>Тестостерон общий</span><span style={{ fontWeight:600, color:'#22c55e' }}>цель 12-30 нмоль/л (350-850 нг/дл)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>ГСПГ (SHBG)</span><span style={{ fontWeight:600, color:'#f59e0b' }}>10-50 нмоль/л</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>Свободный тестостерон</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥0.25 нмоль/л (7.2 нг/дл)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>ЛГ / ФСГ</span><span style={{ fontWeight:600, color:'#06b6d4' }}>1.5-9 МЕ/л</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>Пролактин</span><span style={{ fontWeight:600, color:'#f59e0b' }}>{'<'}15 нг/мл (без гиперпролактинемии)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>Эстрадиол (E2)</span><span style={{ fontWeight:600, color:'#22c55e' }}>10-40 пг/мл (чувствительный метод)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>ПСА</span><span style={{ fontWeight:600, color:'#ef4444' }}>{'<'}4 нг/мл</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>Гематокрит</span><span style={{ fontWeight:600, color:'#ef4444' }}>40-50% (донорство при {">"}54%)</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span>Липидный профиль</span><span style={{ fontWeight:600, color:'#f59e0b' }}>ЛПНП {'<'}3.0, ЛПВП {">"}1.0</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span>HOMA-IR</span><span style={{ fontWeight:600, color:'#22c55e' }}>{'<'}2.5 (норма), {'<'}1.0 (идеал)</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Дополнительно: ТТГ, кортизол, ферритин, витамин D, 25-OH витамин D, цинк плазмы</div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>💊 Формы препаратов тестостерона</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4 }}>
                    <span><b>Энантат</b> — в/м, пик 2-3 д, T½ 8-10 д</span><span style={{ fontWeight:600, color:'#22c55e' }}>100-200 мг × 1/нед</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Ципионат</b> — в/м, пик 2-3 д, T½ 8-12 д</span><span style={{ fontWeight:600, color:'#22c55e' }}>100-200 мг × 1/нед</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4 }}>
                    <span><b>Ундеканоат</b> — в/м, пик 7-9 д, T½ 34 д</span><span style={{ fontWeight:600, color:'#22c55e' }}>750-1000 мг × 1/10-12 нед</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Гели (AndroGel, Testogel)</b> — трансдерм, T½ 2-3 ч</span><span style={{ fontWeight:600, color:'#f59e0b' }}>50-100 мг/день — риск передачи</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4 }}>
                    <span><b>Назальный (Natesto)</b> — интраназ, T½ 10-15 мин</span><span style={{ fontWeight:600, color:'#06b6d4' }}>11 мг 2-3×/д — сохранение фертильности</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Пероральный</b> — подъязычный/букальный</span><span style={{ fontWeight:600, color:'#ef4444' }}>низкая биодоступность, не рекомендован</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Выбор формы: энантат/ципионат — золотой стандарт. Ундеканоат — стабильный уровень. Назальный — при фертильности.</div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ef4444' }}>⚠ Полная таблица лекарственных взаимодействий ГЗТ</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>ГЗТ + ИА (анастрозол)</b></span><span>↓ E2 — риск остеопороза при избытке. Только E2 {">"}50 пг/мл + симптомы</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>ГЗТ + hCG</b></span><span>Сохранение фертильности и объёма яичек. hCG 500 МЕ 2р/нед, 3/1</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>ГЗТ + финастерид</b></span><span>↓ ДГТ, может ↑ E2 и T. Контроль эстрогенов, риск гинекомастии</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>ГЗТ + СИОЗС</b></span><span>↑ пролактин → ↓ либидо. Контроль PRL, возможно ↑ дозы ТЗТ</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>ГЗТ + статины</b></span><span>Статины ↓ ЛПНП, но могут ↓ ЛГ. Контроль липидов и гормонов</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>ГЗТ + варфарин</b></span><span>Усиление антикоагуляции. Контроль MHO каждые 2 нед × 3 мес</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>ГЗТ + опиоиды</b></span><span>Опиоиды подавляют GnRH → ↓ ЛГ/ФСГ. Может потребоваться ↑ дозы ТЗТ</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>ГЗТ + алкоголь</b></span><span>↑ ароматазу, ↓ тестостерон, ↓ качество сна. Ограничить до 1-2 порций/нед</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>ГЗТ + D3/цинк</b></span><span>Синергия: D3 ↑ рецепторы андрогенов, цинк ↑ эндогенный T. Рекомендуется</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>ГЗТ + кломифен</b></span><span>Антагонизм: кломифен блокирует обратную связь, ТЗТ подавляет. Не комбинировать</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>ГЗТ + ГР (гормон роста)</b></span><span>↑ IGF-1, синергия анаболизма. Контроль глюкозы, риск акромегалии</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>ГЗТ + ААС (супра-дозы)</b></span><span>Избыточный Hct, E2, липиды, гепатотоксичность. Только под контролем врача</span>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#8b5cf6' }}>📖 Дополнительные клинические кейсы ГЗТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Кейс 6 (Эритроцитоз):</b> 47 лет, ТЗТ энантат 200 мг/нед 6 мес. Hct 56%, Hb 18.5. Донорство 400 мл × 2 + снижение дозы до 120 мг/нед. Hct стабилизирован на 49%. Рекомендация: контроль Hct каждые 3 мес, донация при {">"}54%.<br/><br/>
                  <b>Кейс 7 (Гинекомастия):</b> 31 год, ТЗТ ципионат 150 мг/нед + отсутствие контроля E2. Через 4 мес: E2 78 пг/мл, болезненность груди, субклиническая гинекомастия. Анастрозол 0.5 мг 2×/нед 4 нед → E2 28, симптомы регресс. Рекомендация: при E2 {">"}50 + симптомы — короткий курс ИА.<br/><br/>
                  <b>Кейс 8 (Фертильность):</b> 29 лет, ТЗТ 3 года без hCG. Объём яичек 8 мл, азооспермия. ТЗТ → hCG 500 МЕ 2р/нед, 3/1 8 нед → энкломифен 25 мг 12 нед. Спермограмма: 22 млн, подвижность 38%.<br/><br/>
                  <b>Кейс 9 (T4DM-метаболический):</b> 48 лет, TT 290, ожирение II, HbA1c 6.9%. ТЗТ ундеканоат 750 мг + диета DASH 1800 ккал + метформин 500 мг. 12 мес: −14 кг, HbA1c 5.8%, TT 620.<br/><br/>
                  <b>Кейс 10 (ПСА-скачок):</b> 62 года, ТЗТ 100 мг/нед 8 нед. ПСА 2.8 → 6.2. МП-МРТ: PIRADS 2 (доброкачественная). ТЗТ продолжена под контролем ПСА каждые 3 мес. Стабилизация на 3.5.
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#06b6d4' }}>📅 График мониторинга ГЗТ</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span><b>Базовый</b></span><span>TT, FT, SHBG, ЛГ, ФСГ, E2, PRL, ПСА, Hct, липиды, HOMA-IR, АЛТ/АСТ, билирубин, ТТГ, кортизол, витамин D, ферритин, DEXA</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>6 недель</b></span><span>TT, FT, E2, Hct, ПСА, АЛТ/АСТ — коррекция дозы</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                    <span><b>3-6 месяцев</b></span><span>TT, FT, E2, Hct, ПСА, липиды, HOMA-IR, АЛТ/АСТ, SHBG — полный протокол</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Ежегодно</b></span><span>ПСА + пальцевое ректальное, DEXA (каждые 2 года), липиды, Hct, HOMA-IR, ЭхоКГ при симптомах</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Инструментально: УЗИ простаты (ежегодно после 50), МП-МРТ при ПСА {">"}4 или подозрении, ЭхоКГ при одышке/отёках</div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ec4899' }}>⚠ Специальные ситуации при ГЗТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>ГЗТ после радикальной простатэктомии (РПЭ):</b> допустима через 1-2 года после РПЭ при ПСА {'<'}0.1. Исследование Bhasin 2019: нет повышения рецидива при низком риске. Только ундеканоат (стабильный уровень). Контроль ПСА каждые 3 мес.<br/><br/>
                  <b>ГЗТ при хронической болезни почек (ХБП):</b> гипогонадизм у 40-60% пациентов с ХБП. ТЗТ улучшает мышечную массу и качество жизни. Ограничение: риск Hct. Старт с низких доз (50-75 мг/нед), контроль цистатина C, креатинина, калия. Избегать пероральных форм.<br/><br/>
                  <b>ГЗТ у пациентов {">"}70 лет:</b> TRAVERSE (NEJM 2023, n=5246): не ↑ MACE, не ↑ РПЖ. Контроль: Hct, ПСА, DEXA. Старт: ундеканоат 500 мг (половина дозы). Цель: TT 450-700 нг/дл (не выше).
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>✅ Итоговый чек-лист ГЗТ</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.6 }}>
                  <div style={{ padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4, marginBottom:2 }}>☐ Подтверждён гипогонадизм (TT {'<'}300 + симптомы × 2 забора до 10:00)</div>
                  <div style={{ padding:'4px 6px', borderRadius:4, marginBottom:2 }}>☐ Базовые анализы: TT, FT, SHBG, ЛГ, ФСГ, E2, PRL, ПСА, Hct, липиды, HOMA-IR + ферритин, D3, ТТГ</div>
                  <div style={{ padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4, marginBottom:2 }}>☐ Выбрана форма: энантат/ципионат 100 мг 1×/нед (старт) / ундеканоат 750 мг / гель 50 мг</div>
                  <div style={{ padding:'4px 6px', borderRadius:4, marginBottom:2 }}>☐ Обсуждена фертильность — hCG 500 МЕ 2р/нед, 3/1 при желании</div>
                  <div style={{ padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4, marginBottom:2 }}>☐ Исключены противопоказания: ПСА {">"}4, Hct {">"}50%, апноэ сна, РПЖ, неконтролируемая СН</div>
                  <div style={{ padding:'4px 6px', borderRadius:4, marginBottom:2 }}>☐ Мониторинг: 6 нед → 3-6 мес → ежегодно</div>
                  <div style={{ padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4, marginBottom:2 }}>☐ Целевые значения: TT 500-850 нг/дл, E2 20-40 пг/мл, Hct {'<'}50%</div>
                  <div style={{ padding:'4px 6px', borderRadius:4 }}>☐ Образ жизни: диета, сон ≥7ч, аэробные нагрузки 150 мин/нед, ограничение алкоголя</div>
                </div>
              </div>

              {/* === HRT ADDITIONS END === */}
          </div>
        )}

        {/* === APPENDED GUIDE CONTENT: FERTILITY === */}
        {tab === 'overview' && restrictToMode === 'fertility' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={s.card}>
              <h4 style={{ margin:'0 0 6px', fontSize:14, color:'#3b82f6' }}>🧬 Ориентировочный протокол по сохранению и восстановлению фертильности</h4>
                <p style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.5, margin:0 }}>
                  Стероид-индуцированный гипогонадизм (SIH) — основная причина мужского бесплодия среди пользователей ААС. Полное восстановление сперматогенеза возможно у 70-80% пациентов при правильном протоколе. Ключевые маркеры: Ингибин B ({'>'}80 pg/mL) — прямой маркер функции клеток Сертоли; АМГ — резерв сперматогенеза; спермограмма + MAR + DFI.
                </p>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ef4444' }}>💥 Степень вреда ААС по данным исследований</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div><b>Тренболон</b> — чрезвычайно высокий (полное выключение оси за 2-3 дня, кисспептин-блокада)</div>
                  <div><b>Нандролон</b> — очень высокий (прогестиновое + андрогеновое подавление, 9-15 мес восстановления)</div>
                  <div><b>Станозолол</b> — высокий (6-12 мес, ↓ SHBG)</div>
                  <div><b>Оксандролон</b> — средний (4-8 нед при {'>'}20 мг/день)</div>
                  <div><b>Тестостерон</b> — дозозависимый (ТЗТ → минимально; супра-физиологический → полное выключение)</div>
                  <div><b>Примоболан/Мастерон</b> — низкий (4-8 нед, частичное сохранение ЛГ)</div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>🛡 Профилактика на курсе</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>hCG параллельно курсу:</b> 500 МЕ 2р/нед, 3/1, начиная с 1-й недели курса. Поддерживает интратестикулярный тестостерон и объём яичек. Доказано: hCG предотвращает атрофию клеток Лейдига.<br/><br/>
                  <b>Прегненолон backfill:</b> прегненолон 50-100 мг/день — предшественник всех стероидов, снижает подавление эндогенного синтеза.<br/><br/>
                  <b>Криоконсервация:</b> обязательна при планировании фертильности — заморозка до начала курса.<br/><br/>
                  <b>Зачатие на «мосту»:</b> hCG 500 МЕ 2р/нед, 3/1 + энкломифен 12.5 мг/день. Риск SDF — обязательный контроль DFI.
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#8b5cf6' }}>💊 Протоколы восстановления фертильности</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#22c55e' }}>Watchful waiting (3-6 мес)</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)' }}>При лёгком подавлении — отмена ААС + нутрицевтическая поддержка. Контроль спермограммы.</div>
                  </div>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#3b82f6' }}>СЕРМ-монотерапия (4-6 мес)</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)' }}>Энкломифен 25 мг/день или кломифен 50 мг/день. Эффективность: 51.9% восстановления.</div>
                  </div>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#8b5cf6' }}>Комбинированная (ПКТ+) — золотой стандарт</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)' }}>hCG 500 МЕ 2р/нед, 3/1 × 2-3 нед → энкломифен 25 мг 8-12 нед. При азооспермии: hMG 75-150 МЕ/день. Эффективность: 66.8%.</div>
                  </div>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)' }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'#f59e0b' }}>Пульсаторный GnRH-насос</div>
                    <div style={{ fontSize:9, color:'var(--text-dim)' }}>При полном отсутствии ответа на СЕРМ/hMG. Восстановление фертильности в 70-80% случаев.</div>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#f59e0b' }}>⚠ Скрытые помехи восстановлению</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Финастерид/дутастерид:</b> блокируют ДГТ → нарушают сперматогенез · <b>Провирон:</b> подавляет ГСПГ, ↑ свободный тестостерон, но ↓ ЛГ<br/>
                  <b>НПВС:</b> ↓ ФСГ через простагландины · <b>Опиоиды:</b> подавляют GnRH · <b>СИОЗС:</b> ↑ пролактин, ↓ либидо<br/>
                  <b>Алкоголь:</b> ↓ тестостерон, ↑ ароматазу · <b>ТГК (марихуана):</b> ↓ ФСГ/ЛГ, ↑ фрагментацию ДНК сперматозоидов<br/>
                  <b>Пептидные ноотропы (рацетамы):</b> GABA-агонисты дополнительно подавляют ось
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#3b82f6' }}>🧬 Перспективные пептиды</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Кисспептин-10:</b> 1-3 мкг/кг — активатор GnRH, восстанавливает половое поведение при подавлении тренболоном<br/>
                  <b>BPC-157:</b> улучшает заживление тканей, протекция яичек<br/>
                  <b>Testivell/Fertivell:</b> бычьи тестикулярные пептиды, восстанавливают сперматогенез в доклинических моделях<br/>
                  <b>Гонадорелин (GnRH):</b> 100 мкг 2-3×/день пульсаторно — прямая стимуляция гипофиза
                </div>
              </div>

              {/* === FERTILITY ADDITIONS START === */}

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ef4444' }}>🧠 Нейротоксичность ААС — 6 механизмов</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>1. Эксайтотоксичность:</b> ААС ↑ глутамат → избыток Ca²⁺ в нейронах → апоптоз GnRH-нейронов гипоталамуса.<br/>
                  <b>2. Окислительный стресс:</b> ↑ активных форм кислорода (АФК) в митохондриях нейронов → повреждение ДНК, липидов мембран.<br/>
                  <b>3. Нейровоспаление:</b> активация микроглии через TLR4 → ↑ IL-6, TNF-α → нейродегенерация.<br/>
                  <b>4. Подавление нейрогенеза:</b> ↓ BDNF в гиппокампе → нарушение памяти, обучения, эмоций.<br/>
                  <b>5. Нарушение ГЭБ:</b> ↑ проницаемость гематоэнцефалического барьера → нейротоксины проникают в мозг.<br/>
                  <b>6. Дефицит нейростероидов:</b> ↓ аллопрегнанолон → GABA-A дисфункция → тревожность, бессонница, депрессия.<br/><br/>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.1)' }}>
                    <b>Клинический вывод:</b> нейропротекция (GlyNAC, PQQ, альфа-липоевая кислота, лития ороат) обязательна на каждом курсе, не только на ПКТ.
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>🥗 Универсальные добавки для фертильности</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:2, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  {[
                    { n:'Цинк (пиколинат)', d:'30-50 мг/день' },
                    { n:'Селен (L-селенометионин)', d:'200 мкг/день' },
                    { n:'Витамин D3', d:'3000-5000 МЕ/день' },
                    { n:'Фолиевая (5-MTHF)', d:'400-800 мкг/день' },
                    { n:'Омега-3 (ЭПК+ДГК)', d:'2-4 г/день' },
                    { n:'L-карнитин + ALCAR', d:'2-3 г/день' },
                    { n:'L-аргинин + L-цитруллин', d:'3-6 г/день' },
                    { n:'CoQ10 (убихинон)', d:'200-400 мг/день' },
                    { n:'Витамин C', d:'1-2 г/день' },
                    { n:'Витамин E (токоферолы)', d:'400-800 МЕ/день' },
                    { n:'NAC', d:'1200 мг/день' },
                    { n:'Мелатонин', d:'1-3 мг перед сном' },
                    { n:'Ашваганда (KSM-66)', d:'600 мг/день' },
                    { n:'Мака (Lepidium meyenii)', d:'3-5 г/день' },
                    { n:'D-аспарагиновая кислота', d:'3 г/день × 2 нед (циклами)' },
                    { n:'Тадалафил', d:'5 мг/день (кровоток яичек)' },
                  ].map((it, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 6px', borderRadius:4, background:i%2===0 ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
                      <span style={{ flex:1 }}>{it.n}</span>
                      <span style={{ fontWeight:600, color:'#22c55e', marginRight:4 }}>{it.d}</span>
                      <button onClick={() => addToCart(`su_fert_${it.n}`, it.n, it.d)} style={{ padding:'2px 6px', borderRadius:4, border:'none', cursor:'pointer', fontSize:7, background:'rgba(245,158,11,0.12)', color:'#f59e0b', flexShrink:0 }}>🛒</button>
                    </div>
                  ))}
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:2 }}>Курс: минимум 3-6 мес для улучшения спермограммы. Комбинации дают синергию.</div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#8b5cf6' }}>🧬 Менопаузальный гонадотропин (МГЧ / hMG) — полный разбор</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Что такое МГЧ?</b> Менопаузальный гонадотропин человека (hMG) — смесь ФСГ + ЛГ (75 МЕ + 75 МЕ), полученная из мочи женщин в менопаузе. Механика: ФСГ стимулирует клетки Сертоли (сперматогенез), ЛГ стимулирует клетки Лейдига (интратестикулярный тестостерон).<br/><br/>
                  <b>Почему ХГЧ недостаточен?</b> ХГЧ имитирует ЛГ → ↑ тестостерон, но НЕ ФСГ → сперматогенез не запускается. Для полноценного сперматогенеза нужны ОБА гонадотропина (ФСГ + ЛГ).<br/><br/>
                  <b>Протоколы:</b> hMG 75-150 МЕ 2-3×/нед подкожно в течение 3-6 мес. Эффективность: восстановление сперматогенеза у 66.8% пациентов с азооспермией.<br/><br/>
                  <b>Побочные:</b> гинекомастия (редко), акне, задержка жидкости, гиперстимуляция (крайне редко).<br/><br/>
                  <b>Доступность:</b> Россия: Прегнил, Профази, Менопур, Гонал-Ф. Стоимость: 2000-4000 ₽/ампула. По ОМС: по назначению андролога/уролога.<br/><br/>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(139,92,246,0.05)', border:'1px solid rgba(139,92,246,0.1)' }}>
                    <b>Ключевое:</b> hMG — золотой стандарт при азооспермии после ААС. Если после 6 мес комбинированной терапии (hCG→СЕРМ) сперматогенез не восстановлен — hMG обязателен.
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ec4899' }}>👩 Женский фактор — чек-ап партнёрши</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Обследование партнёрши (обязательно при планировании):</b><br/><br/>
                  <b>АМГ (антимюллеров гормон):</b> овариальный резерв. Норма: 1.0-4.0 нг/мл.{'<'}1.0 → сниженный резерв.<br/>
                  <b>УЗИ малого таза:</b> фолликулометрия, овуляция, эндометрий. Проводится на 5-12 день цикла.<br/>
                  <b>Проходимость маточных труб:</b> гистеросальпингография (ГСГ) или лапароскопия.<br/>
                  <b>ТТГ (тиреотропный гормон):</b> цель {'<'}2.5 мМЕ/л. Субклинический гипотиреоз {'>'}2.5 → коррекция.<br/><br/>
                  <b>Вспомогательные репродуктивные технологии (ВРТ):</b><br/>
                  <b>ВМИ (внутриматочная инсеминация):</b> при лёгких нарушениях спермограммы. Шанс: 10-20% на цикл.<br/>
                  <b>ЭКО (экстракорпоральное оплодотворение):</b> при умеренных нарушениях. Шанс: 30-40% на попытку.<br/>
                  <b>ИКСИ (интрацитоплазматическая инъекция сперматозоида):</b> при тяжёлой олиго/астенозооспермии.<br/>
                  <b>ПИКСИ (физиологический отбор сперматозоидов):</b> отбор по связыванию с гиалуронаном — меньше фрагментации ДНК.<br/><br/>
                  <b>Фертильное окно:</b> 6 дней (5 дней до овуляции + день овуляции). Пик фертильности: за 2 дня до овуляции. Определение: тесты ЛГ, цервикальная слизь, базальная температура.
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#06b6d4' }}>💊 Энкломифен — детальный разбор</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Что такое энкломифен?</b> Чистый изомер кломифена (zu-кломифен). В отличие от рацемического кломифена (смесь энкломифена + зукломифена), энкломифен является СЕРМ (селективный модулятор эстрогеновых рецепторов) с преимущественным действием на гипофиз.<br/><br/>
                  <b>Механизм:</b> блокирует эстрогеновые рецепторы в гипоталамусе и гипофизе → снимает ингибирующее действие эстрадиола на секрецию ЛГ/ФСГ → ↑ эндогенный тестостерон.<br/><br/>
                  <b>Исследования:</b> Kaminetsky et al. 2013 (J Urol): энкломифен 25 мг/день ↑ TT с 198 до 597 нг/дл у мужчин с гипогонадизмом. Kim et al. 2016: энкломифен не ↑ E2 (в отличие от ТЗТ), сохраняет фертильность.<br/><br/>
                  <b>Позиция BSSM/AUA:</b> энкломифен рекомендован как альтернатива ТЗТ при желании фертильности. Доказательства: уровень 1B (умеренный).<br/><br/>
                  <b>Меньше побочек vs кломифен:</b> энкломифен не содержит зукломифен (эндо-изомер), который вызывает зрительные нарушения, эмоциональную лабильность, и имеет длительный T½ (10-30 дней). Энкломифен: T½ 10-12 ч.<br/><br/>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(6,182,212,0.05)', border:'1px solid rgba(6,182,212,0.1)' }}>
                    <b>Дозировка:</b> 12.5-25 мг/день. Старт: 12.5 мг × 2 нед → оценка ЛГ/ФСГ → 25 мг при недостаточном ответе. Максимум: 50 мг/день (редко).
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ef4444' }}>🚫 Скрытые помехи — детальная таблица</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>Финастерид/дутастерид</b></span><span>Блокируют 5α-редуктазу → ↓ ДГТ → нарушение сперматогенеза. Отменить {'>'}6 мес до планирования</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>НПВС (ибупрофен, диклофенак)</b></span><span>↓ ФСГ через подавление простагландинов. Курсовой приём → обратимое снижение параметров спермы</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>Опиоиды (трамадол, морфин)</b></span><span>Подавляют GnRH → ↓ ЛГ/ФСГ → ↓ тестостерон + сперматогенез. Отмена → восстановление за 4-12 нед</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>СИОЗС (флуоксетин, пароксетин)</b></span><span>↑ пролактин → ↓ либидо, ↑ фрагментацию ДНК сперматозоидов. Замена на бупропион</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>Алкоголь (≥3 порций/день)</b></span><span>↓ тестостерон, ↑ ароматазу, ↓ качество спермы. Полная отмена за 3 мес до планирования</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Марихуана (ТГК)</b></span><span>↓ ФСГ/ЛГ через CB1-рецепторы, ↑ фрагментацию ДНК сперматозоидов, ↓ подвижность</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(239,68,68,0.05)', borderRadius:4 }}>
                    <span><b>Кортикостероиды</b></span><span>↓ ЛГ через подавление кортикотропин-рилизинг-гормона. Не рекомендованы при планировании</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Антипсихотики (галоперидол, рисперидон)</b></span><span>↑ пролактин (до {'>'}100 нг/мл) → полное подавление ЛГ/ФСГ. Коррекция: арипипразол</span>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#f59e0b' }}>🧠 Ноотропы и фертильность — таблица совместимости</h4>
                <div style={{ display:'flex', flexDirection:'column', gap:3, fontSize:9, color:'var(--text-dim)', lineHeight:1.4 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(245,158,11,0.05)', borderRadius:4 }}>
                    <span><b>Рацетамы (пирацетам, фенилпирацетам, прамирацетам)  — нейтрально</b></span><span>Нет данных о влиянии на HPTA. GABA-модуляция минимальна. Безопасны при фертильности</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>ГАМК-агонисты (фенибут, баклофен, габапентин) — НЕ рекомендованы</b></span><span>GABA-B агонисты ↓ GnRH, ↓ ЛГ. Фенибут: риск подавления при {'>'}2 нед приёма</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(245,158,11,0.05)', borderRadius:4 }}>
                    <span><b>Холинергические (альфа-ГФХ, цитиколин, DMAE)  — нейтрально</b></span><span>Ацетилхолин не влияет на HPTA напрямую. Безопасны. Могут улучшать мотивацию к терапии</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Пептидные (семакс, церебролизин, ноопепт) — недостаточно данных</b></span><span>Нет исследований влияния на мужскую фертильность. Теоретически: семакс ↑ BDNF, что положительно</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', background:'rgba(245,158,11,0.05)', borderRadius:4 }}>
                    <span><b>Бромантан</b></span><span>Дофаминергический адаптоген. ↑ мотивацию, не влияет на HPTA. Может помочь при апатии на ПКТ</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 6px', borderRadius:4 }}>
                    <span><b>Кисспептин-10</b></span><span>Активатор GnRH. Восстанавливает пульсаторную секрецию ЛГ. Перспективный пептид для фертильности</span>
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#22c55e' }}>❓ FAQ: Фертильность — 8 главных вопросов</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>1. Сколько времени нужно для восстановления спермограммы?</b> Минимум 3-6 мес (один полный цикл сперматогенеза — 74 дня + транспорт). При тяжёлом подавлении — до 12-18 мес.<br/><br/>
                  <b>2. Какие ААС НАИБОЛЕЕ опасны для фертильности?</b> Тренболон (полное выключение за 2-3 дня), нандролон (9-15 мес восстановления), станозолол (6-12 мес).<br/><br/>
                  <b>3. Когда нужна криоконсервация?</b> До начала первого курса. Если уже на курсе — немедленно отменить и сдать через 3-5 дней после отмены (пока есть сперматозоиды).<br/><br/>
                  <b>4. ЭКО/ИКСИ при азооспермии?</b> Да. TESA/TESE (биопсия яичка) позволяет получить сперматозоиды даже при азооспермии. Эффективность ИКСИ с TESE: 40-50%.<br/><br/>
                  <b>5. Влияет ли возраст на восстановление?</b> Да. После 35 лет — восстановление на 30% дольше. После 45 — риск необратимости выше, рекомендована криоконсервация.<br/><br/>
                  <b>6. Можно ли зачать во время ПКТ?</b> Да, но риск ↑ фрагментации ДНК (SDF) в первые 4-8 нед. Рекомендован контроль DFI. Оптимально: начинать попытки через 3-4 мес после старта ПКТ.<br/><br/>
                  <b>7. Что делать, если после ПКТ спермограмма не восстановилась?</b> Шаг 1: СЕРМ 12 нед. Шаг 2: hCG + hMG 6 мес. Шаг 3: GnRH-насос. Шаг 4: TESE/биопсия. Полное восстановление у 85-90% при последовательной терапии.<br/><br/>
                  <b>8. Нужна ли генетическая консультация?</b> Да, при: азооспермии неясного генеза, тяжёлой олигозооспермии ({'<'}5 млн/мл), повторных неудачах ВРТ, семейном анамнезе бесплодия.
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#ec4899' }}>😌 Психологические ловушки при восстановлении фертильности</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>1. Гормональные качели:</b> резкое падение тестостерона в первые недели ПКТ → депрессия, тревожность, апатия, ангедония. Важно: предупредить партнёра и врача.<br/><br/>
                  <b>2. Секс «по расписанию»:</b> принудительные половые акты в фертильное окно → ↓ качества отношений, ↓ спонтанности. Рекомендация: не фокусироваться только на «окне», сохранять близость вне цикла.<br/><br/>
                  <b>3. Туннельное зрение на ребёнке:</b> когда вся жизнь сводится к зачатию → ↑ стресс → ↑ кортизол → ↓ тестостерон → порочный круг. Рекомендация: КПТ, хобби, физическая активность без фокуса на фертильность.<br/><br/>
                  <b>4. Сравнение с другими:</b> «он восстановился за 2 месяца, а я нет» — каждый случай уникален. Факторы: соединения, стаж, возраст, генетика, комплаентность.<br/><br/>
                  <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(236,72,153,0.05)', border:'1px solid rgba(236,72,153,0.1)' }}>
                    <b>Рекомендация:</b> КПТ (когнитивно-поведенческая терапия), группы поддержки (Reddit r/steroids, r/maleinfertility), психоэдукация партнёра, дневник прогресса (объективные анализы, а не субъективные ощущения).
                  </div>
                </div>
              </div>

              <div style={s.card}>
                <h4 style={{ margin:'0 0 6px', fontSize:12, color:'#06b6d4' }}>📋 Приложения — нормы ВОЗ 2021 и чек-лист</h4>
                <div style={{ fontSize:9, color:'var(--text-dim)', lineHeight:1.5 }}>
                  <b>Нормы спермограммы (ВОЗ 2021, 6-е издание):</b><br/>
                  <div style={{ display:'flex', flexDirection:'column', gap:2, margin:'4px 0' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                      <span>Объём эякулята</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥1.4 мл</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', borderRadius:4 }}>
                      <span>Концентрация сперматозоидов</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥16 млн/мл</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                      <span>Общее количество</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥39 млн</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', borderRadius:4 }}>
                      <span>Подвижность (PR + NP)</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥42%</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                      <span>Прогрессивная подвижность (PR)</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥30%</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', borderRadius:4 }}>
                      <span>Морфология (строгие критерии Крюгера)</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥4%</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', background:'rgba(6,182,212,0.05)', borderRadius:4 }}>
                      <span>Жизнеспособность</span><span style={{ fontWeight:600, color:'#22c55e' }}>≥54%</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 6px', borderRadius:4 }}>
                      <span>DFI (фрагментация ДНК)</span><span style={{ fontWeight:600, color:'#f59e0b' }}>{'<'}30% (идеал {'<'}15%)</span>
                    </div>
                  </div>
                  <b style={{ marginTop:4, display:'block' }}>Чек-лист перед курсом:</b>
                  <div style={{ padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4, marginTop:2 }}>☐ Криоконсервация спермы (обязательно при планировании детей в ближайшие 3 года)</div>
                  <div style={{ padding:'4px 6px', borderRadius:4 }}>☐ Базовая спермограмма + MAR-тест + DFI</div>
                  <div style={{ padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4 }}>☐ Ингибин B, АМГ, ЛГ, ФСГ, TT, E2, PRL, SHBG</div>
                  <div style={{ padding:'4px 6px', borderRadius:4 }}>☐ Планирование длительности курса (не {'>'}20 нед без перерыва при желании фертильности)</div>
                  <div style={{ padding:'4px 6px', background:'rgba(34,197,94,0.05)', borderRadius:4 }}>☐ hCG на курсе (500 МЕ 2р/нед, 3/1) или прегненолон backfill</div>
                </div>
              </div>

              {/* === FERTILITY ADDITIONS END === */}
          </div>
        )}

      </div>
    </div>
  );
};

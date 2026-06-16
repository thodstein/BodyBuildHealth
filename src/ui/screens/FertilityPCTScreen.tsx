import React, { useState, useMemo, useEffect } from 'react';
import { calcFertility } from '../../engines/fertility.engine';
import type { FertilityInput, FertilityResult, LabPoint, CourseEntry } from '../../core/types';
import { FERTILITY_TARGET, FERTILITY_TAU_WEEKS } from '../../core/constants';
import { db } from '../../core/db';
import { getProfile } from '../../core/profile-manager';
import { generatePCTPlan } from '../../engines/pct-planner.engine';
import { PHARMA_DB } from '../../core/pharma-database';

type FertTab = 'overview' | 'semen' | 'hormones' | 'structure' | 'pct-plan' | 'hrt' | 'analyses' | 'brain';

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 },
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
  const [tab, setTab] = useState<FertTab>('overview');

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
    <div className="form-group">
      <label>{label}</label>
      <input type="number" step={step} value={val || ''} onChange={e => set(e.target.value)} placeholder={placeholder} />
    </div>
  );

  const fertTabs: { id: FertTab; label: string }[] = [
    { id: 'overview', label: '📋 Обзор' },
    { id: 'semen', label: 'Спермограмма' }, { id: 'hormones', label: 'Гормоны' }, { id: 'structure', label: 'DFI/Структура' },
    { id: 'pct-plan', label: 'ПКТ план' }, { id: 'hrt', label: '⚕️ ГЗТ' }, { id: 'analyses', label: '🧪 Анализы' }, { id: 'brain', label: '🧠 Гайд' }
  ];

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
    <div className="screen fertility-pct">
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>ПКТ и гормональное здоровье</h2>

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

      <div style={{ maxWidth: '100%', overflowX: 'hidden', wordBreak: 'break-word' }}>

      {/* ─── OVERVIEW TAB ─── */}
      {tab === 'overview' && (
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
                { code: 'SPERM', name: 'Спермограмма' }, { code: 'CBC', name: 'ОАК' },
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
              <p style={{ fontSize: 11, margin: '0 0 8px' }}>500–1000 МЕ 2–3 раза в неделю начиная с 3-й недели цикла.</p>
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

      {tab === 'semen' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Спермограмма расширенная</h4>
          <div style={s.row}>
            <div>{field('Объём (мл) ≥1.5', volume, setVolume, '1.5')}</div>
            <div>{field('Концентрация (млн/мл) ≥16', concentration, setConcentration, '16')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Общее кол-во (млн) ≥39', totalCount, setTotalCount, '39')}</div>
            <div>{field('PR подвижность (%) ≥30', pr, setPr, '30')}</div>
          </div>
          <div style={s.row}>
            <div>{field('NP подвижность (%)', np, setNp, '10')}</div>
            <div>{field('Неподвижные (%)', immotile, setImmotile, '0')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Морфология (%) ≥4', morphology, setMorphology, '4')}</div>
            <div>{field('Жизнеспособность (%) ≥58', viability, setViability, '58')}</div>
          </div>
          <div style={s.row}>
            <div>{field('pH 7.2–8.0', ph, setPh, '7.4')}</div>
            <div>{field('Фруктоза (ммоль/л)', fructose, setFructose, '13')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Цинк (ммоль/л)', zincMmol, setZincMmol, '2')}</div>
            <div>{field('MAR-тест (%) <50', mar, setMar, '0')}</div>
          </div>
          <div style={s.row}>
            <div>{field('Лейкоциты (млн/мл)', leukocytes, setLeukocytes, '0')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 10 }}><input type="checkbox" style={s.check} checked={viscosity} onChange={e => setViscosity(e.target.checked)} /> Вязкость</label>
              <label style={{ fontSize: 10 }}><input type="checkbox" style={s.check} checked={agglutination} onChange={e => setAgglutination(e.target.checked)} /> Агглютинация</label>
            </div>
          </div>
        </div>
      )}

      {tab === 'hormones' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Гормоны крови (10 маркеров)</h4>
          <p style={{ fontSize: 10, opacity: 0.6, margin: '0 0 8px' }}>Автозаполнение из LabsScreen</p>
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
      )}

      {tab === 'structure' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>DFI и структурные факторы</h4>
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
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>План ПКТ</h4>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{PHARMA_DB[p.substanceId]?.name || p.substanceId}</span>
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${CLASS_COLORS[p.class] || '#666'}22`, color: CLASS_COLORS[p.class] || '#666' }}>{CLASS_LABEL_PCT[p.class] || p.class}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{p.doseValue}{p.doseUnit}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                      {p.timing || `${p.frequency}`} | Нед {p.startWeek}-{p.endWeek}
                    </div>
                  </div>
                ))}
                <button onClick={() => setPctPlan(null)} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}>✕ Сбросить</button>
              </div>
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
              Научно обоснованные протоколы ТЗТ/ГЗТ, мониторинг и адъювантная терапия.
            </p>

            <h5 style={{ margin:'0 0 6px', fontSize:11, color:'#22c55e' }}>💉 Протоколы ТЗТ (тестостерон-заместительная терапия)</h5>
            <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
              {[
                { name:'Тестостерон энантат/ципионат', dose:'100-200 мг/нед', freq:'Инъекция 1 раз/нед', note:'Базовый протокол, стабильный уровень' },
                { name:'Тестостерон ундеканоат (Nebido)', dose:'1000 мг', freq:'Каждые 10-14 недель', note:'Длительное действие, редкие инъекции' },
                { name:'Тестостерон гель', dose:'50-100 мг/день', freq:'Ежедневно на кожу', note:'Физиологичные уровни, меньше колебаний' },
                { name:'ХГЧ (hCG)', dose:'250-500 МЕ', freq:'2-3 раза/нед', note:'Сохранение фертильности, стимуляция Лейдигов' },
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
                </div>
              ))}
            </div>

            <h5 style={{ margin:'0 0 6px', fontSize:11, color:'#60a5fa' }}>📊 Параметры мониторинга</h5>
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
              {[
                { param:'Общий тестостерон (TT)', target:'500-900 нг/дл', freq:'Каждые 3-6 мес' },
                { param:'Свободный тестостерон (FT)', target:'15-25 пг/мл', freq:'Каждые 3-6 мес' },
                { param:'Эстрадиол E2 (чувствительный)', target:'20-40 пг/мл', freq:'Каждые 3-6 мес' },
                { param:'SHBG (ГСПГ)', target:'20-40 нмоль/л', freq:'Каждые 6 мес' },
                { param:'Гематокрит (Hct)', target:'< 50%', freq:'Каждые 3 мес' },
                { param:'ПСА (простат-специфический антиген)', target:'< 4.0 нг/мл', freq:'Каждые 6-12 мес (мужчины >40)' },
                { param:'Липидный профиль', target:'ЛПНП < 100, ЛПВП > 40', freq:'Каждые 6-12 мес' },
              ].map((m, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.1)', flexWrap:'wrap', gap:4 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{m.param}</div>
                    <div style={{ fontSize:8, color:'var(--text-dim)' }}>{m.freq}</div>
                  </div>
                  <span style={{ fontSize:9, fontWeight:700, color:'#60a5fa' }}>{m.target}</span>
                </div>
              ))}
            </div>

            <h5 style={{ margin:'0 0 6px', fontSize:11, color:'#f59e0b' }}>💊 Адъювантная терапия</h5>
            <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
              {[
                { name:'Анастрозол', dose:'0.25-0.5 мг 2×/нед', note:'Только при E2 > 50 пг/мл + симптомы' },
                { name:'ХГЧ (hCG)', dose:'250-500 МЕ 2×/нед', note:'При желании сохранить фертильность' },
                { name:'Донаторы NO (цитруллин)', dose:'3-6 г/день', note:'Поддержка эндотелиальной функции' },
              ].map((r, i) => (
                <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#f59e0b' }}>{r.dose}</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{r.note}</div>
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

      {tab === 'brain' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={s.card}>
            <h4 style={{ margin:'0 0 6px', fontSize:14, color:'#ec4899' }}>🧠 Мозг и фертильность</h4>
            <p style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.5, margin:0 }}>
              Анаболические стероиды напрямую повреждают гипоталамо-гипофизарно-тестикулярную ось (HPTA). Андрогены подавляют GnRH-нейроны гипоталамуса через андрогеновые рецепторы → снижение секреции гонадотропин-рилизинг-гормона → падение ЛГ и ФСГ. Нейростероиды (аллопрегнанолон, андростандиол) модулируют GABA-A рецепторы, вызывая депрессию и тревожность. Кисспептин-нейроны повреждаются нандролоном и тренболоном, блокируя половое поведение и сперматогенез. Восстановление оси занимает от 6 до 18+ месяцев.
            </p>
          </div>

          <div style={s.card}>
            <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#f59e0b' }}>💊 Степень вреда ААС для HPTA</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[
                { name:'Тренболон', level:'Чрезвычайно высокий', detail:'Полное выключение оси за 2-3 дня. Глубокое подавление кисспептина и GnRH. Восстановление 12-18+ мес.', color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
                { name:'Нандролон', level:'Очень высокий', detail:'Прогестиновое подавление + андрогеновое. Ось выключается за 5-7 дней. Восстановление 9-15 мес.', color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
                { name:'Станозолол', level:'Высокий', detail:'Сильное подавление ГСПГ + андрогеновое выключение. Восстановление 6-12 мес.', color:'#f97316', bg:'rgba(249,115,22,0.1)' },
                { name:'Оксандролон', level:'Средний', detail:'Умеренное подавление оси при дозировках >20 мг/день. Восстановление 4-8 нед.', color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
                { name:'Тестостерон', level:'Дозозависимый', detail:'Физиологические дозы (ТЗТ): минимальное подавление ЛГ. Супрафизиологические: полное выключение. Восстановление 6-18 мес.', color:'#eab308', bg:'rgba(234,179,8,0.1)' },
                { name:'Примоболан', level:'Низкий', detail:'Метил-ДГТ, слабое подавление. Частичное сохранение ЛГ. Восстановление 4-8 нед.', color:'#22c55e', bg:'rgba(34,197,94,0.1)' },
                { name:'Мастерон', level:'Низкий', detail:'Дростанолон, слабое подавление оси. Восстановление 4-8 нед.', color:'#22c55e', bg:'rgba(34,197,94,0.1)' },
                { name:'Туринабол', level:'Средне-высокий', detail:'17α-алкилирован, гепатотоксичен + подавление оси. Восстановление 6-10 нед.', color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
              ].map((r, i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:r.bg, border:`1px solid ${r.color}22` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text-light)' }}>{r.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:r.color }}>{r.level}</span>
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{r.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.card}>
            <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#22c55e' }}>🛡 Универсальные добавки для восстановления</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { name:'Коэнзим Q10', dose:'200-600 мг/день', note:'Митохондриальная поддержка сперматозоидов, антиоксидант' },
                { name:'Омега-3 (EPA+DHA)', dose:'3-5 г/день', note:'Мембраны сперматозоидов, противовоспалительный' },
                { name:'Цинк пиколинат', dose:'30-50 мг/день', note:'Кофактор 5α-редуктазы, сперматогенез, тестостерон' },
                { name:'Селен (селексен)', dose:'200 мкг/день', note:'Глутатионпероксидаза, подвижность сперматозоидов' },
                { name:'Витамин D3', dose:'4000-5000 МЕ/день', note:'Рецепторы VDR в яичках, ↑ тестостерон через ЛГ' },
                { name:'Витамин E', dose:'400-800 МЕ/день', note:'Мембранный антиоксидант, защита сперматозоидов' },
                { name:'L-карнитин', dose:'2-3 г/день', note:'Энергетика митохондрий сперматозоидов, подвижность' },
                { name:'NAC', dose:'1200 мг/день', note:'Предшественник глутатиона, защита клеток Лейдига' },
              ].map((sup, i) => (
                <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(0,230,138,0.04)', border:'1px solid rgba(0,230,138,0.1)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{sup.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#00e68a' }}>{sup.dose}</span>
                  </div>
                  <div style={{ fontSize:8, color:'var(--text-dim)', marginTop:1 }}>{sup.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.card}>
            <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#8b5cf6' }}>💉 Протокол ПКТ</h4>
            <div style={{ fontSize:11, color:'var(--text-dim)', marginBottom:8, lineHeight:1.4 }}>
              Восстановление HPTA после курса ААС: 2-фазный подход с гонадотропинами и СЕРМами.
            </div>
            <div style={{ background:'rgba(139,92,246,0.08)', borderRadius:8, padding:10, border:'1px solid rgba(139,92,246,0.15)', marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#8b5cf6', marginBottom:4 }}>Фаза 1: hCG (стимуляция Лейдигов)</div>
              <div style={{ fontSize:10, color:'var(--text-light)', lineHeight:1.4 }}>
                hCG 2000-3000 МЕ через день (EOD) × 2-3 недели.<br/>
                Цель: восстановление объёма яичек, подготовка к СЕРМ-терапии.
              </div>
            </div>
            <div style={{ background:'rgba(34,197,94,0.08)', borderRadius:8, padding:10, border:'1px solid rgba(34,197,94,0.15)', marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#22c55e', marginBottom:4 }}>Фаза 2: СЕРМ (стимуляция оси)</div>
              <div style={{ fontSize:10, color:'var(--text-light)', lineHeight:1.4 }}>
                <b>Вариант A:</b> Кломифен 50 мг/день 2 нед + Тамоксифен 20 мг/день 4-6 нед<br/>
                <b>Вариант B:</b> Энкломифен 25 мг/день 4-6 нед<br/>
                Цель: ЛГ, ФСГ &gt; 5; тестостерон &gt; 15 нмоль/л.
              </div>
            </div>
            <div style={{ background:'rgba(245,158,11,0.08)', borderRadius:8, padding:10, border:'1px solid rgba(245,158,11,0.15)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#f59e0b', marginBottom:4 }}>⏱ Тайминг</div>
              <div style={{ fontSize:10, color:'var(--text-light)', lineHeight:1.4 }}>
                • Эфиры тестостерона (эн/цип): через 14-21 день после последней инъекции<br/>
                • Ундеканоат: через 4-6 недель<br/>
                • Нандролон: через 21-28 дней (деканоат), через 7-10 дней (фенилпропионат)<br/>
                • Тренболон: через 14-21 день (энантат), через 5-7 дней (ацетат)
              </div>
            </div>
          </div>

          <div style={s.card}>
            <h4 style={{ margin:'0 0 8px', fontSize:13, color:'#3b82f6' }}>🧬 Пептиды для восстановления</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { name:'Гонадорелин (GnRH)', dose:'100 мкг 2-3×/день', note:'Синтетический GnRH, непосредственно стимулирует гипофиз → ↑ЛГ/ФСГ. Пульсаторный режим обязателен.' },
                { name:'Кисспептин-10', dose:'1-3 мкг/кг', note:'Активатор GnRH-нейронов. Критичен при подавлении тренболоном/нандролоном. Восстанавливает половое поведение.' },
                { name:'hMG (менопаузный гонадотропин)', dose:'75-150 МЕ/день', note:'Содержит ЛГ и ФСГ. Стимулирует сперматогенез напрямую. 3-6 мес курс.' },
                { name:'рФСГ (рекомбинантный ФСГ)', dose:'75-150 МЕ 3×/нед', note:'Чистый ФСГ, стимуляция клеток Сертоли → сперматогенез. При азооспермии.' },
              ].map((p, i) => (
                <div key={i} style={{ padding:'8px 10px', borderRadius:8, background:'rgba(59,130,246,0.04)', border:'1px solid rgba(59,130,246,0.12)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--text-light)' }}>{p.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#3b82f6' }}>{p.dose}</span>
                  </div>
                  <div style={{ fontSize:9, color:'var(--text-dim)', marginTop:2, lineHeight:1.3 }}>{p.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

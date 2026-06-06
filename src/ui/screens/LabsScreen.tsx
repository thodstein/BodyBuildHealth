import React, { useState, useEffect, useRef } from 'react';
import {
  addLabPoint,
  getLabHistory,
  getLabTrend,
  normalizeLab,
  UCUM_MAP
} from '../../engines/labs.engine';
import { calculateRisks } from '../../engines/risk.engine';
import { generateSupportStack } from '../../engines/support.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { drawLabTrend } from '../../ui/charts-labs';
import { db } from '../../core/db';
import { RISK_SYSTEMS } from '../../core/constants';
import { parseLabText } from '../../core/lab-auto-parser';
import { parseLabFile, type ParsedLabValue } from '../../engines/pdf-parser.engine';
import { resolveLabMarker, interpretRatio, normalizedRatio } from '../../core/labs-mapping';
import { computeLabIndices, interpretLabIndices } from '../../engines/labs-indices.engine';
import { PHASE_REQUIRED_PANELS, LAB_PANELS, type LabPanelMarker } from '../../data/labs-phase-panels';
import type { LabPoint, UserProfile, RiskResult, CourseEntry } from '../../core/types';
import { SYSTEM_INFO } from '../../core/risk-info';

// Маппинг UCUM кодов на системы на основе SYSTEM_INFO.keyMarkers
const MARKER_SYSTEM_MAP: Record<string, string[]> = {};
Object.entries(SYSTEM_INFO).forEach(([sysKey, sysInfo]) => {
  sysInfo.keyMarkers.forEach(marker => {
    // Пытаемся найти UCUM код по имени маркера
    Object.entries(UCUM_MAP).forEach(([code, ucum]) => {
      if (ucum.name.toLowerCase().includes(marker.toLowerCase()) || 
          code.toLowerCase().includes(marker.toLowerCase())) {
        if (!MARKER_SYSTEM_MAP[code]) MARKER_SYSTEM_MAP[code] = [];
        if (!MARKER_SYSTEM_MAP[code].includes(sysKey)) {
          MARKER_SYSTEM_MAP[code].push(sysKey);
        }
      }
    });
  });
});

// Для показателей без точного совпадения - добавляем вручную
const MANUAL_MARKER_SYSTEMS: Record<string, string> = {
  'ALT': 'hepatic', 'AST': 'hepatic', 'GGT': 'hepatic', 'BIL': 'hepatic', 'ALB': 'hepatic',
  'CREATININE': 'renal', 'UREA': 'renal', 'UA': 'renal',
  'HGB': 'hematic', 'HCT': 'hematic', 'PLT': 'hematic', 'WBC': 'hematic',
  'TT': 'endocrine', 'E2': 'endocrine', 'LH': 'endocrine', 'FSH': 'endocrine', 'PRL': 'endocrine', 'TSH': 'endocrine',
  'LDL': 'cardio', 'HDL': 'cardio', 'TG': 'cardio', 'CRP': 'cardio',
  'GLU': 'endocrine', 'INS': 'endocrine', 'HOMA': 'endocrine',
  'FT': 'endocrine', 'DHT': 'endocrine', 'PROG': 'endocrine',
  'SHBG': 'endocrine', 'CORTISOL': 'endocrine', 'IGF1': 'endocrine',
  'CA': 'musculoskeletal', 'P': 'musculoskeletal', 'MG': 'musculoskeletal', 'VITD': 'musculoskeletal', 'ALP': 'musculoskeletal',
  'K': 'cardio', 'NA': 'cardio',
  'FERRITIN': 'hematic', 'B12': 'hematic', 'FOL': 'hematic', 'TIBC': 'hematic',
  'DHEA_S': 'endocrine', 'AMH': 'reproductive', 'INHB': 'reproductive', 'PSA': 'reproductive'
};

Object.entries(MANUAL_MARKER_SYSTEMS).forEach(([code, sys]) => {
  if (!MARKER_SYSTEM_MAP[code]) MARKER_SYSTEM_MAP[code] = [];
  if (!MARKER_SYSTEM_MAP[code].includes(sys)) MARKER_SYSTEM_MAP[code].push(sys);
});

// Для маркеров из UCUM_MAP, которые не попали в маппинг - добавляем по умолчанию
Object.keys(UCUM_MAP).forEach(code => {
  if (!MARKER_SYSTEM_MAP[code]) {
    // По умолчанию распределяем по системам на основе названия
    const codeLower = code.toLowerCase();
    if (['alt', 'ast', 'ggt', 'bil', 'alb', 'tp'].some(k => codeLower.includes(k))) MARKER_SYSTEM_MAP[code] = ['hepatic'];
    else if (['creatinine', 'urea', 'ua'].some(k => codeLower.includes(k))) MARKER_SYSTEM_MAP[code] = ['renal'];
    else if (['hgb', 'hct', 'plt', 'wbc', 'ferritin', 'b12', 'fol', 'tibc'].some(k => codeLower.includes(k))) MARKER_SYSTEM_MAP[code] = ['hematic'];
    else if (['tt', 'e2', 'lh', 'fsh', 'prl', 'tsh', 'ft3', 'ft4', 'igf1', 'ins', 'glu', 'hom a', 'ft', 'dht', 'prog', 'shbg', 'cortisol', 'dhea'].some(k => codeLower.includes(k))) MARKER_SYSTEM_MAP[code] = ['endocrine'];
    else if (['ldl', 'hdl', 'tg', 'crp'].some(k => codeLower.includes(k))) MARKER_SYSTEM_MAP[code] = ['cardio'];
    else if (['ca', 'p', 'mg', 'vitd', 'alp'].some(k => codeLower.includes(k))) MARKER_SYSTEM_MAP[code] = ['musculoskeletal'];
    else if (['k', 'na'].some(k => codeLower.includes(k))) MARKER_SYSTEM_MAP[code] = ['cardio'];
    else MARKER_SYSTEM_MAP[code] = ['hepatic']; // по умолчанию в печень
  }
});

const SYSTEM_LABELS: Record<string, string> = {
  hepatic: 'Печень', cardio: 'Сердечно-сосудистая', endocrine: 'Эндокринная',
  lipid: 'Липидный обмен', renal: 'Почки', hematic: 'Кроветворение', immune: 'Иммунная',
  neuro: 'Нервная', reproductive: 'Репродуктивная', musculoskeletal: 'Суставы и связки'
};

type LabTab = 'input' | 'panels' | 'history' | 'indices';

interface LabsProps {
  initialTab?: LabTab;
}

export const LabsScreen: React.FC<LabsProps> = ({ initialTab = 'input' }) => {
  const [tab, setTab] = useState<LabTab>(initialTab);
  const [entries, setEntries] = useState<LabPoint[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPanel, setSelectedPanel] = useState<string>('cbc');
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrResult, setOcrResult] = useState<{ marker: string; value: number; unit: string; name: string }[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [labIndices, setLabIndices] = useState({ inflammation: 0, metabolism: 0, thyroid: 0, lipids: 0 });
  const [labIndexText, setLabIndexText] = useState({ inflammation: '', metabolism: '', thyroid: '', lipids: '' });
  const [phase, setPhase] = useState<'baseline' | 'on_cycle' | 'pct' | 'bridge' | 'fertility'>('baseline');
  const [markerValues, setMarkerValues] = useState<Record<string, { value: string; unit: string }>>({});
  const [selectedSystem, setSelectedSystem] = useState<string>('hepatic');
  const [collapsedSystems, setCollapsedSystems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        await db.init();
        const prof = await db.get<UserProfile>('profile', 'current-user');
        setProfile(prof ?? {
          id: 'current-user', name: 'Текущий пользователь', role: 'user',
          settings: { age: 30, sex: 'male', weight: 70, goal: 'muscle gain', phase: 'baseline', courseStartDate: new Date().toISOString().slice(0, 10), height: 180, bodyFat: 15 }
        });
        const courseEntries = await db.getAll<CourseEntry>('course_log');
        setCourse(courseEntries);
        const labEntries = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
        const userLabs = labEntries.filter(l => l.patientId === 'current-user');
        setEntries(userLabs);
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (profile?.settings?.phase) {
      setPhase(profile.settings.phase as any);
    }
  }, [profile?.settings?.phase]);

  useEffect(() => {
    if (entries.length > 0) {
      const indices = computeLabIndices(entries);
      setLabIndices(indices);
      setLabIndexText(interpretLabIndices(indices));
    }
  }, [entries]);

  useEffect(() => {
    recalcRisks();
  }, [entries, profile, course]);

  const recalcRisks = async () => {
    if (!profile) return;
    try {
      const genetics: Record<string, string> = profile.settings?.genetics ?? {};
      const nutritionFactor = profile.settings?.nutritionFactor ?? 1.0;
      const trainingFactor = profile.settings?.trainingFactor ?? 1.0;
      const activeDrugs: Record<string, { dosePerWeek: number }> = {};
      course.forEach(entry => {
        const freq = typeof entry.frequency === 'number' ? entry.frequency : entry.frequency === 'daily' ? 7 : entry.frequency === 'eod' ? 3.5 : 1;
        activeDrugs[entry.substanceId] = { dosePerWeek: entry.doseValue * freq };
      });
      const result = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs, supportCoverage: {} });
      const labRisks = calculateRiskFromAnalyses(entries);
      const combinedRaw: Record<string, number> = {};
      RISK_SYSTEMS.forEach(s => {
        combinedRaw[s] = Math.max(
          result.systemBreakdown?.[s]?.raw ?? 0,
          labRisks.systemContributions?.[s as keyof typeof labRisks.systemContributions] ?? 0
        );
      });
      const supportSubs = generateSupportStack(profile.settings.goal ?? 'maintenance');
      const coverageMap: Record<string, number> = {};
      for (const sub of supportSubs) {
        if (sub.effects) {
          for (const eff of sub.effects) {
            coverageMap[eff.effect] = (coverageMap[eff.effect] || 0) + eff.strength;
          }
        }
      }
      const finalRisks = calculateRisks({ genetics, nutritionFactor, trainingFactor, activeDrugs, supportCoverage: coverageMap });
      setRisk(finalRisks);
    } catch (e) {
      console.error('Risk calc error:', e);
    }
  };

  const saveMarker = async (code: string, marker: LabPanelMarker) => {
    const val = markerValues[code];
    if (!val?.value) return;
    const numVal = parseFloat(val.value);
    if (isNaN(numVal)) return;
    const point: LabPoint = {
      id: Math.random().toString(36).slice(2, 11),
      code,
      name: marker.label,
      value: numVal,
      unit: val.unit || marker.unit,
      date: new Date().toISOString().slice(0, 10),
      phase,
      patientId: 'current-user'
    };
    try {
      await addLabPoint('current-user', point);
      setEntries(prev => [...prev, point]);
      setMarkerValues(prev => ({ ...prev, [code]: { value: '', unit: val.unit || marker.unit } }));
    } catch (e) {
      console.error('Failed to add lab point:', e);
    }
  };

  const saveMarkerFromUCUM = async (code: string, ucum: any) => {
    const val = markerValues[code];
    if (!val?.value) return;
    const numVal = parseFloat(val.value);
    if (isNaN(numVal)) return;
    const point: LabPoint = {
      id: Math.random().toString(36).slice(2, 11),
      code,
      name: ucum.name,
      value: numVal,
      unit: val.unit || ucum.prefUnit,
      date: new Date().toISOString().slice(0, 10),
      phase,
      patientId: 'current-user'
    };
    try {
      await addLabPoint('current-user', point);
      setEntries(prev => [...prev, point]);
      setMarkerValues(prev => ({ ...prev, [code]: { value: '', unit: val.unit || ucum.prefUnit } }));
    } catch (e) {
      console.error('Failed to add lab point:', e);
    }
  };

  const importFromText = async () => {
    const parsed = parseLabText(ocrText);
    if (!parsed.length) { setOcrResult([]); return; }
    const results = parsed.map(p => ({
      marker: p.marker,
      value: p.value,
      unit: p.unit,
      name: UCUM_MAP[p.marker]?.name ?? p.marker
    }));
    setOcrResult(results);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    try {
      const result = await parseLabFile(file);
      if (result.values.length > 0) {
        const results = result.values.map(v => ({
          marker: v.code,
          value: v.value,
          unit: v.unit,
          name: v.name
        }));
        setOcrResult(results);
        if (result.rawText) setOcrText(result.rawText);
      }
    } catch (err) {
      console.error('File parse error:', err);
    } finally {
      setFileLoading(false);
      e.target.value = '';
    }
  };

  const confirmOcrResults = async () => {
    for (const r of ocrResult) {
      const point: LabPoint = {
        id: Math.random().toString(36).slice(2, 11),
        code: r.marker,
        name: r.name,
        value: r.value,
        unit: r.unit,
        date: new Date().toISOString().slice(0, 10),
        phase,
        patientId: 'current-user'
      };
      await addLabPoint('current-user', point);
    }
    const labEntries = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
    setEntries(labEntries.filter(l => l.patientId === 'current-user'));
    setOcrText('');
    setOcrResult([]);
  };

  const deleteEntry = async (id: string) => {
    await db.delete('labs_log', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const getLatestEntry = (codes: string[]) => {
    const set = new Set(codes.map(c => c.toUpperCase()));
    const filtered = entries.filter(e => set.has(e.code.toUpperCase()));
    if (!filtered.length) return null;
    return filtered.sort((a, b) => b.date.localeCompare(a.date))[0];
  };

  const getNormUnit = (code: string, value: number, unit: string) => {
    const m = UCUM_MAP[code];
    if (!m) return '\u2014';
    const n = normalizeLab(code, value, unit);
    return `${n.norm} ${n.unit}`;
  };

  const ratioForPoint = (e: LabPoint): number | null => {
    const u = UCUM_MAP[e.code];
    if (!u) return null;
    const n = normalizeLab(e.code, e.value, e.unit);
    const span = u.uln - u.lln;
    if (span <= 0) return null;
    return Math.max(0, Math.min(1, (n.norm - u.lln) / span));
  };

  useEffect(() => {
    if (!selectedMarker || !canvasRef.current) return;
    const pts = entries.filter(e => e.code === selectedMarker).sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length < 2) return;
    const ucum = UCUM_MAP[selectedMarker];
    if (!ucum) return;
    const baseDate = new Date(pts[0].date);
    const chartData = pts.map(p => {
      const d = new Date(p.date);
      return { week: (d.getTime() - baseDate.getTime()) / (7 * 86400000), value: p.value, isAbnormal: false };
    });
    drawLabTrend(canvasRef.current, chartData, ucum.uln, ucum.lln, ucum.prefUnit, ucum.name);
  }, [selectedMarker, entries, canvasKey]);

  const allPanelMarkers = Object.values(LAB_PANELS).flatMap(p => p.markers);
  const requiredPanels = PHASE_REQUIRED_PANELS[phase] ?? PHASE_REQUIRED_PANELS.baseline;
  const missingMarkers = requiredPanels
    .flatMap(pid => (LAB_PANELS[pid]?.markers ?? []).map(m => m.ucumCode ?? m.id))
    .filter(code => !entries.some(e => e.code.toUpperCase() === code.toUpperCase()));
  const hasNoLabs = entries.length === 0;
  const hasAnyLabs = entries.length > 0;

  if (loading) return <div className="loading-screen"><div className="loading-spinner"/><span>Загрузка...</span></div>;

  const TABS: { id: LabTab; label: string }[] = [
    { id: 'input', label: 'Ввод анализов' },
    { id: 'panels', label: 'Панели' },
    { id: 'history', label: 'История' },
    { id: 'indices', label: 'Индексы' },
  ];

  return (
    <div className="screen labs">
      <h2>Лабораторные анализы</h2>

      {!hasAnyLabs && missingMarkers.length > 0 && (
        <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 14, marginBottom: 4 }}>&#9888; Не хватает показателей для фазы «{phase === 'on_cycle' ? 'Курс' : phase === 'pct' ? 'ПКТ' : phase === 'bridge' ? 'Мост' : phase === 'fertility' ? 'Фертильность' : 'Базовая'}»</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Рекомендуется ввести: {missingMarkers.join(', ')}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} className={'btn secondary' + (tab === t.id ? ' active' : '')} style={{ padding: '10px 14px', whiteSpace: 'nowrap' }} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'input' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3>&#128221; Вставить текст анализа</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Вставьте текст из лабораторного бланка (Инвитро, Гемотест, Хеликс, KDL). Поддерживаются форматы: «Гемоглобин 140 г/л», «АЛТ: 25 U/L (0-40)», «HGB 140 g/L».</p>
            <textarea
              className="input"
              rows={5}
              placeholder={"Гемоглобин 140 г/л\nАЛТ 25 U/L\nКреатинин 85 мкмоль/л\nХолестерин общий 5.2 ммоль/л"}
              value={ocrText}
              onChange={e => setOcrText(e.target.value)}
              style={{ width: '100%', marginBottom: 8, fontFamily: 'monospace', fontSize: 13 }}
            />
             <button className="btn" onClick={importFromText} disabled={!ocrText.trim()}>
               &#128270; Распознать и добавить
            </button>
            <label style={{ display: 'inline-block', marginLeft: 8, padding: '8px 14px', background: 'var(--accent-blue)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              &#128196; Загрузить PDF/фото
              <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} style={{ display: 'none' }} disabled={fileLoading} />
            </label>
            {fileLoading && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent-blue)' }}>Обработка...</span>}
            {ocrResult.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4>Распознано {ocrResult.length} показателей:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {ocrResult.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
                      <span>{r.name} ({r.marker})</span>
                      <span style={{ fontWeight: 600 }}>{r.value} {r.unit}</span>
                    </div>
                  ))}
                </div>
                <button className="btn" style={{ marginTop: 8 }} onClick={confirmOcrResults}>&#10004; Подтвердить и сохранить все</button>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3>&#128736; Ввод анализов по системам</h3>
            
            {/* Выбор системы */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {Object.entries(SYSTEM_LABELS).map(([sysKey, sysLabel]) => (
                <button
                  key={sysKey}
                  className={`btn${selectedSystem === sysKey ? ' active' : ''}`}
                  style={{ fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}
                  onClick={() => setSelectedSystem(sysKey)}
                >
                  {sysLabel}
                </button>
              ))}
            </div>
            
            {/* Показатели выбранной системы */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                // Получаем все коды для выбранной системы
                const systemCodes = Object.entries(UCUM_MAP).filter(([code]) => {
                  const systems = MARKER_SYSTEM_MAP[code] || [];
                  return systems.includes(selectedSystem);
                });
                
                if (systemCodes.length === 0) {
                  return <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Нет показателей для этой системы</p>;
                }
                
                return systemCodes.map(([code, ucum]) => {
                  const existing = getLatestEntry([code]);
                  const val = markerValues[code]?.value ?? '';
                  const unit = markerValues[code]?.unit ?? ucum.prefUnit;
                  const existingRatio = existing ? ratioForPoint(existing) : null;
                  const statusColor = existingRatio === null ? 'var(--text-dim)' : existingRatio < 0.2 ? 'var(--danger)' : existingRatio < 0.4 ? 'var(--warning)' : existingRatio < 0.8 ? 'var(--success)' : 'var(--danger)';
                  
                  return (
                    <div key={code} style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{ucum.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>({code})</span>
                        </div>
                        {existing && (
                          <span style={{ fontSize: 11, color: statusColor }}>
                            {existing.value} {existing.unit}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
                        Норма: {ucum.lln}–{ucum.uln} {ucum.prefUnit}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="Значение"
                          className="input"
                          style={{ flex: 1, fontSize: 13 }}
                          value={val}
                          onChange={e => setMarkerValues(prev => ({ ...prev, [code]: { value: e.target.value, unit } }))}
                        />
                        <input
                          type="text"
                          placeholder="Ед."
                          className="input"
                          style={{ width: 70, fontSize: 13 }}
                          value={unit}
                          onChange={e => setMarkerValues(prev => ({ ...prev, [code]: { value: val, unit: e.target.value } }))}
                        />
                        <button className="btn" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }} onClick={() => saveMarkerFromUCUM(code, ucum)} disabled={!val}>
                          &#10004;
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </>
      )}

      {tab === 'panels' && (
        <>
          {/* Panel Selection with Direct Input */}
          <div className="card" style={{ marginBottom: 12 }}>
            <h3>&#128736; Панели анализов</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {Object.entries(LAB_PANELS).map(([key, panel]) => {
                const filled = panel.markers.filter(m => entries.some(e => e.code === (m.ucumCode ?? m.id))).length;
                const total = panel.markers.length;
                const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                return (
                  <button key={key} className={'btn secondary' + (selectedPanel === key ? ' active' : '')} onClick={() => setSelectedPanel(key)}>
                    {panel.label} ({filled}/{total})
                  </button>
                );
              })}
            </div>

            {/* Direct Input Under Panel Selection */}
            {LAB_PANELS[selectedPanel] && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: '0 0 10px' }}>{LAB_PANELS[selectedPanel].label}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {LAB_PANELS[selectedPanel].markers.map(marker => {
                    const code = marker.ucumCode ?? marker.id;
                    const ucum = UCUM_MAP[code];
                    const existing = getLatestEntry([code]);
                    const val = markerValues[code]?.value ?? '';
                    const unit = markerValues[code]?.unit ?? ucum?.prefUnit ?? '';
                    const ratio = existing ? ratioForPoint(existing) : null;
                    const statusColor = ratio === null ? 'var(--text-dim)' : ratio < 0.2 ? 'var(--danger)' : ratio < 0.4 ? 'var(--warning)' : ratio < 0.8 ? 'var(--success)' : 'var(--danger)';

                    return (
                      <div key={code} style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{marker.label}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 6 }}>({code})</span>
                          </div>
                          {existing && (
                            <span style={{ fontSize: 11, color: statusColor }}>
                              {existing.value} {existing.unit}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
                          Норма: {marker.ref[0]}–{marker.ref[1]} {marker.unit}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="number"
                            placeholder="Значение"
                            className="input"
                            style={{ flex: 1, fontSize: 13 }}
                            value={val}
                            onChange={e => setMarkerValues(prev => ({ ...prev, [code]: { value: e.target.value, unit } }))}
                          />
                          <input
                            type="text"
                            placeholder="Ед."
                            className="input"
                            style={{ width: 70, fontSize: 13 }}
                            value={unit}
                            onChange={e => setMarkerValues(prev => ({ ...prev, [code]: { value: val, unit: e.target.value } }))}
                          />
                          <button className="btn" style={{ whiteSpace: 'nowrap', padding: '4px 10px' }} onClick={() => saveMarkerFromUCUM(code, ucum)} disabled={!val}>
                            &#10004;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, marginTop: 12 }}>
            <h3 style={{ margin: '0 0 8px' }}>&#128203; Рекомендуемые панели для фазы «{phase === 'on_cycle' ? 'Курс' : phase === 'pct' ? 'ПКТ' : phase === 'bridge' ? 'Мост' : phase === 'fertility' ? 'Фертильность' : 'Базовая'}»</h3>
            {requiredPanels.map(pid => {
              const panel = LAB_PANELS[pid];
              if (!panel) return null;
              const filled = panel.markers.filter(m => entries.some(e => e.code === (m.ucumCode ?? m.id))).length;
              const total = panel.markers.length;
              return (
                <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13 }}>{panel.label}</span>
                  <span style={{ fontSize: 12, color: filled === total ? 'var(--success)' : 'var(--warning)' }}>{filled}/{total} заполнено</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          {selectedMarker && (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {UCUM_MAP[selectedMarker]?.name ?? selectedMarker} ({selectedMarker})
                </h3>
                <button className="btn secondary" style={{ fontSize: 11 }} onClick={() => setSelectedMarker(null)}>Закрыть</button>
              </div>
              {(() => {
                const ucum = UCUM_MAP[selectedMarker];
                return ucum ? (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                    Норма: {ucum.lln}–{ucum.uln} {ucum.prefUnit}
                  </div>
                ) : null;
              })()}
              <canvas key={canvasKey} ref={canvasRef} width={380} height={140} style={{ width: '100%', maxHeight: 180 }} />
              <table className="lab-table" style={{ marginTop: 8 }}>
                <thead><tr><th>Дата</th><th>Значение</th><th>Ед.</th><th>Норма</th><th>Оценка</th><th></th></tr></thead>
                <tbody>
                  {entries.filter(e => e.code === selectedMarker).sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      <td style={{ fontWeight: 600 }}>{e.value}</td>
                      <td>{e.unit}</td>
                      <td>{getNormUnit(e.code, e.value, e.unit)}</td>
                      <td style={{ color: (() => { const r = ratioForPoint(e); return r === null ? 'var(--text-dim)' : r < 0.4 ? 'var(--warning)' : r < 0.8 ? 'var(--success)' : 'var(--danger)'; })() }}>
                        {interpretRatio(ratioForPoint(e))}
                      </td>
                      <td><button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }} onClick={() => deleteEntry(e.id)}>&#10005;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <h3>Все результаты</h3>
            {entries.length === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>Нет сохранённых анализов. Перейдите на вкладку «Ввод анализов» чтобы добавить данные.</p>
            ) : (
              <table className="lab-table">
                <thead><tr><th>Дата</th><th>Показатель</th><th>Значение</th><th>Ед.</th><th>Норма</th><th>Оценка</th><th></th></tr></thead>
                <tbody>
                  {entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50).map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      <td style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => { setSelectedMarker(e.code); setCanvasKey(k => k + 1); }}>{UCUM_MAP[e.code]?.name ?? e.name ?? e.code}</td>
                      <td style={{ fontWeight: 600 }}>{e.value}</td>
                      <td>{e.unit}</td>
                      <td>{getNormUnit(e.code, e.value, e.unit)}</td>
                      <td style={{ color: (() => { const r = ratioForPoint(e); return r === null ? 'var(--text-dim)' : r < 0.4 ? 'var(--warning)' : r < 0.8 ? 'var(--success)' : 'var(--danger)'; })() }}>
                        {interpretRatio(ratioForPoint(e))}
                      </td>
                      <td><button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }} onClick={() => deleteEntry(e.id)}>&#10005;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'indices' && (
        <div className="card">
          <h3>Индексы гормонального баланса</h3>
          {entries.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>Введите анализы для расчёта индексов</p>
          ) : (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {[
                { key: 'inflammation' as const, label: 'Воспаление', icon: '&#128293;' },
                { key: 'metabolism' as const, label: 'Метаболизм', icon: '&#9889;' },
                { key: 'thyroid' as const, label: 'Щитовидная', icon: '&#129530;' },
                { key: 'lipids' as const, label: 'Липиды', icon: '&#128156;' }
              ].map(({ key, label, icon }) => {
                const val = labIndices[key] * 100;
                const text = labIndexText[key];
                const color = val < 30 ? 'var(--success)' : val < 60 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <div key={key} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 24 }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color, margin: '4px 0' }}>{val.toFixed(0)}%</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{text}</div>
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 3, height: 4, marginTop: 6 }}>
                      <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <h3>Связь с нутрициологией</h3>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              {[
                { title: 'Метаболическое здоровье', codes: [['GLU', 'GLUCOSE'], ['INS']], recs: ['Снизить простые углеводы', 'Увеличить клетчатку', 'Белок в каждый приём пищи'] },
                { title: 'Липидный профиль', codes: [['CHOL', 'TCHOL'], ['HDL'], ['LDL'], ['TG']], recs: ['Омега-3 (рыба, льняное семя)', 'Заменить насыщенные жиры', 'Растворимая клетчатка'] },
                { title: 'Печень и детокс', codes: [['ALT'], ['AST'], ['GGT'], ['BILI', 'BILIRUBIN']], recs: ['Крестоцветные овощи', 'N-ацетилцистеин', 'Продукты с серой (чеснок, яйца)'] },
                { title: 'Воспаление', codes: [['CRP'], ['FERRITIN']], recs: ['Омега-3 кислоты', 'Антиоксиданты (ягоды, овощи)', 'Куркумин с чёрным перцем'] }
              ].map(({ title, codes, recs }) => (
                <div key={title} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12 }}>
                  <h4 style={{ margin: '0 0 8px' }}>{title}</h4>
                  {codes.map((codeGroup, i) => {
                    const pt = getLatestEntry(codeGroup);
                    return pt ? (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span>{UCUM_MAP[pt.code]?.name ?? pt.code}:</span>
                        <span style={{ color: (() => { const r = ratioForPoint(pt); return r === null ? 'var(--text-dim)' : r < 0.4 ? 'var(--warning)' : r < 0.8 ? 'var(--success)' : 'var(--danger)'; })() }}>
                          {pt.value} {pt.unit}
                        </span>
                      </div>
                    ) : (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 2 }}>
                        {codeGroup[0]}: не измерено
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                    {recs.map((r, i) => <div key={i}>&#8226; {r}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
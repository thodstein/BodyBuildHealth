import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  addLabPoint,
  getLabHistory,
  getLabTrend,
  normalizeLab,
  UCUM_MAP
} from '../../engines/labs.engine';
import { calculateRiskFromAnalyses } from '../../engines/risk-calculator-v2.engine';
import { drawLabTrend } from '../../ui/charts-labs';
import { db } from '../../core/db';
import { RISK_SYSTEMS } from '../../core/constants';
import { parseLabText } from '../../core/lab-auto-parser';
import { parseLabFile, type ParsedLabValue } from '../../engines/pdf-parser.engine';
import { resolveLabMarker, interpretRatio, normalizedRatio } from '../../core/labs-mapping';
import { computeLabIndices, interpretLabIndices } from '../../engines/labs-indices.engine';
import { PHASE_REQUIRED_PANELS, LAB_PANELS, type LabPanelMarker } from '../../data/labs-phase-panels';
import { generateLabSchedule, getCurrentLabStatus, getDrugSpecificLabs, getWeeksSinceStart, type LabScheduleItem } from '../../engines/labs-schedule.engine';
import { analyzeLabDrugCorrelation, type LabDrugAlert } from '../../engines/lab-pharma-correlation.engine';
import { generateCheckpoints } from '../../engines/labs-scheduler.engine';
import type { LabPoint, RiskResult, CourseEntry } from '../../core/types';
import { useDataLink, notifyDataChange } from '../../core/data-link';

const SYSTEM_LABELS: Record<string, string> = {
  hepatic: 'Печень', cardio: 'Сердечно-сосудистая', endocrine: 'Эндокринная',
  lipid: 'Липидный обмен', renal: 'Почки', hematic: 'Кроветворение', immune: 'Иммунная',
  neuro: 'Нервная', reproductive: 'Репродуктивная', musculoskeletal: 'Суставы и связки'
};

type LabTab = 'input' | 'panels' | 'schedule' | 'history' | 'indices' | 'risks' | 'investigations';

interface LabsProps {
  initialTab?: LabTab;
}

export const LabsScreen: React.FC<LabsProps> = ({ initialTab = 'input' }) => {
  const [tab, setTab] = useState<LabTab>(initialTab);
  const linked = useDataLink();
  const profile = linked.profile;
  const course = linked.course;
  const entries = linked.labs;
  const risk = linked.risk;
  const activeDrugs = linked.activeDrugs;
  const [selectedPanel, setSelectedPanel] = useState<string>('cbc');
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrResult, setOcrResult] = useState<{ marker: string; value: number; unit: string; name: string; isAbnormal?: boolean; deviation?: 'low' | 'high' }[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [labIndices, setLabIndices] = useState({ inflammation: 0, metabolism: 0, thyroid: 0, lipids: 0 });
  const [labIndexText, setLabIndexText] = useState({ inflammation: '', metabolism: '', thyroid: '', lipids: '' });
  const [phase, setPhase] = useState<'baseline' | 'on_cycle' | 'pct' | 'bridge' | 'fertility'>('baseline');
  const [markerValues, setMarkerValues] = useState<Record<string, { value: string; unit: string }>>({});
  const [invDone, setInvDone] = useState<Record<string, boolean>>({});
  const [labSchedule, setLabSchedule] = useState<LabScheduleItem[]>([]);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [manualMarker, setManualMarker] = useState('');
  const [labRisks, setLabRisks] = useState<Record<string, number>>({});

  const hasLabs = entries.length > 0;

  useEffect(() => {
    if (hasLabs) {
      const labRisksResult = calculateRiskFromAnalyses(entries);
      setLabRisks(labRisksResult.systemContributions);
    }
  }, [entries, hasLabs]);

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
    if (!profile?.settings?.courseStartDate) return;
    const w = getWeeksSinceStart(profile.settings.courseStartDate);
    setCurrentWeek(w);
    const schedule = generateLabSchedule({
      phase: profile.settings.phase ?? 'baseline',
      courseStartDate: profile.settings.courseStartDate,
      courseEntries: course,
      currentWeek: w
    });
    setLabSchedule(schedule);
  }, [profile?.settings?.phase, profile?.settings?.courseStartDate, course]);

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
      setMarkerValues(prev => ({ ...prev, [code]: { value: '', unit: val.unit || marker.unit } }));
      notifyDataChange();
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
      name: UCUM_MAP[p.marker]?.name ?? p.marker,
      isAbnormal: p.isAbnormal
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
          name: v.name,
          isAbnormal: v.isAbnormal
        }));
        setOcrResult(results);
        if (result.rawText) setOcrText(result.rawText);
        if (result.warnings?.length) {
          console.warn('OCR Warnings:', result.warnings);
        }
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
    notifyDataChange();
    setOcrText('');
    setOcrResult([]);
  };

  const deleteEntry = async (id: string) => {
    await db.delete('labs_log', id);
    notifyDataChange();
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

  const TABS: { id: LabTab; label: string; icon?: string; col: 'results' | 'catalog' }[] = [
    { id: 'input', label: 'Ввод', icon: '📝', col: 'results' },
    { id: 'panels', label: 'Панели', icon: '🧪', col: 'catalog' },
    { id: 'schedule', label: 'Расписание', icon: '📅', col: 'catalog' },
    { id: 'history', label: 'История', icon: '📊', col: 'results' },
    { id: 'indices', label: 'Индексы', icon: '📈', col: 'results' },
    { id: 'risks', label: 'Риски', icon: '⚠️', col: 'results' },
    { id: 'investigations', label: 'Исследования', icon: '🔬', col: 'catalog' },
  ];

  return (
    <div className="screen labs">
      <h2>Лабораторные анализы</h2>

      {hasNoLabs && (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 15, marginBottom: 4 }}>&#9888; Анализы обязательны!</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Для расчёта рисков и рекомендаций необходимо ввести результаты анализов. Введите данные вручную или вставьте текст из лабораторного бланка.</div>
        </div>
      )}

      {!hasNoLabs && missingMarkers.length > 0 && (
        <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 14, marginBottom: 4 }}>&#9888; Не хватает показателей для фазы «{phase === 'on_cycle' ? 'Курс' : phase === 'pct' ? 'ПКТ' : phase === 'bridge' ? 'Мост' : phase === 'fertility' ? 'Фертильность' : 'Базовая'}»</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Рекомендуется ввести: {missingMarkers.join(', ')}</div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        {/* Results column tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 8px', color: 'var(--text-dim)' }}>📊 Результаты:</span>
          {TABS.filter(t => t.col === 'results').map(t => (
            <button key={t.id} className={'btn secondary' + (tab === t.id ? ' active' : '')} style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: 12, padding: '6px 10px' }} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {/* Catalog column tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '6px 8px', color: 'var(--text-dim)' }}>🗂️ Каталоги:</span>
          {TABS.filter(t => t.col === 'catalog').map(t => (
            <button key={t.id} className={'btn secondary' + (tab === t.id ? ' active' : '')} style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: 12, padding: '6px 10px' }} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'input' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Left column: Lab input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Penalty toggle button - без анализов */}
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 13 }}>⚠️ Штраф за отсутствие анализов</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {profile?.settings?.forceNoLabsPenalty 
                      ? 'Штрафные коэффициенты применены к рискам.' 
                      : 'Нажмите, чтобы применить штрафные коэффициенты при отсутствии анализов.'}
                  </div>
                </div>
                <button 
                  className="btn"
                  style={{ 
                    background: profile?.settings?.forceNoLabsPenalty ? 'rgba(239,68,68,0.3)' : 'var(--danger)', 
                    color: profile?.settings?.forceNoLabsPenalty ? '#fff' : '#fff',
                    borderColor: 'var(--danger)',
                    fontWeight: 700 
                  }} 
                  onClick={async () => {
                    if (!profile?.id) return;
                    const { updateProfile } = await import('../../core/profile-manager');
                    await updateProfile(profile.id, {
                      ...profile,
                      settings: {
                        ...profile.settings,
                        forceNoLabsPenalty: !profile.settings?.forceNoLabsPenalty
                      }
                    });
                    notifyDataChange();
                  }}
                >
                  {profile?.settings?.forceNoLabsPenalty ? '✅ Применён' : '🚫 БЕЗ АНАЛИЗОВ'}
                </button>
              </div>
            </div>
            
            <div className="card">
              <h3>&#128221; Вставить текст анализа</h3>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                  Вставьте текст из лабораторного бланка (Инвитро, Гемотест, Хеликс, KDL). 
                  Поддерживаются форматы: «Гемоглобин 140 г/л», «АЛТ: 25 U/L (0-40)», «HGB 140 g/L».
                </p>
                <textarea
                  className="input"
                  rows={5}
                  placeholder={"Гемоглобин 140 г/л\nАЛТ 25 U/L\nКреатинин 85 мкмоль/л\nХолестерин общий 5.2 ммоль/л"}
                  value={ocrText}
                  onChange={e => setOcrText(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, fontFamily: 'monospace', fontSize: 13 }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <button className="btn" onClick={importFromText} disabled={!ocrText.trim()}>
                    &#128270; Распознать и добавить
                  </button>
                  <label style={{ padding: '8px 14px', background: 'var(--accent-blue)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    &#128196; Загрузить PDF/фото
                    <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} style={{ display: 'none' }} disabled={fileLoading} />
                  </label>
                  {fileLoading && <span style={{ fontSize: 12, color: 'var(--accent-blue)' }}>Обработка...</span>}
                </div>
                {ocrResult.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ margin: '0 0 8px' }}>Распознано {ocrResult.length} показателей:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {ocrResult.map((r, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: r.isAbnormal ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)',
                          border: r.isAbnormal ? '1px solid rgba(239,68,68,0.2)' : 'none',
                          padding: '8px 12px', borderRadius: 8, fontSize: 13
                        }}>
                          <span>{r.name} ({r.marker})</span>
                          <span style={{ fontWeight: 600, color: r.isAbnormal ? 'var(--danger)' : 'var(--text)' }}>
                            {r.value} {r.unit}
                            {r.isAbnormal && r.deviation === 'low' && <span style={{ marginLeft: 6, color: 'var(--danger)' }}>↓</span>}
                            {r.isAbnormal && r.deviation === 'high' && <span style={{ marginLeft: 6, color: 'var(--danger)' }}>↑</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                    {ocrResult.some(r => r.isAbnormal) && (
                      <div style={{
                        marginBottom: 8, padding: '8px 12px', background: 'var(--danger-dim)',
                        border: '1px solid var(--danger)', borderRadius: 8, fontSize: 11, color: 'var(--danger)'
                      }}>
                        ⚠️ Обнаружены отклонения от нормы. Проверьте значения и при необходимости скорректируйте.
                      </div>
                    )}
                    <button className="btn" style={{ marginTop: 8 }} onClick={confirmOcrResults}>&#10004; Подтвердить и сохранить все</button>
                  </div>
                )}
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <h3>&#128736; Быстрый ввод по группам</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {Object.entries(LAB_PANELS).map(([key, panel]) => {
                const allFilled = panel.markers.every(m => entries.some(e => e.code === (m.ucumCode ?? m.id)));
                return (
                  <button key={key} className={'btn secondary' + (selectedPanel === key ? ' active' : '')} style={{ background: allFilled ? 'var(--success-dim)' : undefined, borderColor: allFilled ? 'var(--success)' : undefined }} onClick={() => setSelectedPanel(key)}>
                    {allFilled ? '&#10003; ' : ''}{panel.label}
                  </button>
                );
              })}
            </div>
            {LAB_PANELS[selectedPanel] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {LAB_PANELS[selectedPanel].markers.map(marker => {
                  const code = marker.ucumCode ?? marker.id;
                  const existing = getLatestEntry([code]);
                  const val = markerValues[code]?.value ?? '';
                  const unit = markerValues[code]?.unit ?? marker.unit;
                  const existingRatio = existing ? ratioForPoint(existing) : null;
                  const statusColor = existingRatio === null ? 'var(--text-dim)' : existingRatio < 0.2 ? 'var(--danger)' : existingRatio < 0.4 ? 'var(--warning)' : existingRatio < 0.8 ? 'var(--success)' : 'var(--danger)';
                  return (
                    <div key={code} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{marker.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>({code})</span>
                          {marker.importance === 'critical' && <span style={{ background: 'var(--danger-dim)', color: 'var(--danger)', fontSize: 10, padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>Критический</span>}
                          {marker.importance === 'important' && <span style={{ background: 'var(--warning-dim)', color: 'var(--warning)', fontSize: 10, padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>Важный</span>}
                        </div>
                        {existing && (
                          <span style={{ fontSize: 12, color: statusColor }}>
                            {existing.value} {existing.unit} — {interpretRatio(existingRatio)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                        Референтные значения: {marker.ref[0]}–{marker.ref[1]} {marker.unit}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="Значение"
                          className="input"
                          style={{ flex: 1, fontSize: 14 }}
                          value={val}
                          onChange={e => setMarkerValues(prev => ({ ...prev, [code]: { value: e.target.value, unit } }))}
                        />
                        <input
                          type="text"
                          placeholder="Ед."
                          className="input"
                          style={{ width: 70, fontSize: 14 }}
                          value={unit}
                          onChange={e => setMarkerValues(prev => ({ ...prev, [code]: { value: val, unit: e.target.value } }))}
                        />
                        <button className="btn" style={{ whiteSpace: 'nowrap' }} onClick={() => saveMarker(code, marker)} disabled={!val}>
                          Сохранить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ marginTop: 12 }}>
            <h3>&#128203; Ручной ввод</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Введите код или название показателя, значение и единицу измерения</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {Object.entries(UCUM_MAP).map(([code, info]) => (
                <button key={code} className="btn secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => {
                  setMarkerValues(prev => ({ ...prev, [code]: { value: prev[code]?.value ?? '', unit: info.prefUnit } }));
                }}>
                  {info.name} ({code})
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" className="input" placeholder="Код (напр. ALT, HGB)" style={{ flex: 1 }} value={(() => {
                const freeEntry = Object.entries(markerValues).find(([k]) => !UCUM_MAP[k] && k.startsWith('_custom_'));
                return freeEntry ? freeEntry[0].replace('_custom_', '') : '';
              })()} onChange={e => {
                const code = resolveLabMarker(e.target.value);
                setMarkerValues(prev => ({ ...prev, [code]: { value: prev[code]?.value ?? '', unit: prev[code]?.unit ?? '' } }));
              }} />
              <input type="number" className="input" placeholder="Значение" style={{ width: 100 }} />
              <input type="text" className="input" placeholder="Ед." style={{ width: 70 }} />
            </div>
              </div>
          </div>
        </div>
      )}

      {tab === 'panels' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
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

          {LAB_PANELS[selectedPanel] && (
            <div className="card">
              <h3>{LAB_PANELS[selectedPanel].label}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {LAB_PANELS[selectedPanel].markers.map(marker => {
                  const code = marker.ucumCode ?? marker.id;
                  const markerEntries = entries.filter(e => e.code === code).sort((a, b) => b.date.localeCompare(a.date));
                  const latest = markerEntries[0];
                  const ucum = UCUM_MAP[code];
                  const ratio = latest ? ratioForPoint(latest) : null;
                  const barPct = ratio !== null ? Math.max(0, Math.min(100, ratio * 100)) : 0;
                  const barColor = ratio === null ? 'var(--border)' : ratio < 0.2 ? 'var(--danger)' : ratio < 0.4 ? 'var(--warning)' : ratio < 0.8 ? 'var(--success)' : ratio < 0.9 ? 'var(--warning)' : 'var(--danger)';
                  return (
                    <div key={code} style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 12, cursor: 'pointer' }} onClick={() => { setSelectedMarker(code); setTab('history'); }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{marker.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>{code}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {latest ? (
                            <span style={{ fontSize: 16, fontWeight: 700, color: barColor }}>{latest.value} {latest.unit}</span>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Не введено</span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                        Норма: {marker.ref[0]}–{marker.ref[1]} {marker.unit}
                        {latest && <span style={{ marginLeft: 8, color: barColor }}>{interpretRatio(ratio)}</span>}
                      </div>
                      <div style={{ background: 'var(--bg-secondary)', borderRadius: 3, height: 4, marginTop: 6 }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      {markerEntries.length > 1 && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                          {markerEntries.length} замеров · Последний: {latest?.date}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

      {tab === 'schedule' && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3>Расписание анализов</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
              Неделя {currentWeek} с начала курса · Фаза: {phase === 'on_cycle' ? 'Курс' : phase === 'pct' ? 'ПКТ' : phase === 'bridge' ? 'Мост' : phase === 'fertility' ? 'Фертильность' : 'Базовая'}
            </p>
            {labSchedule.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Укажите дату начала курса в профиле для генерации расписания.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {labSchedule.map((item, idx) => {
                  const labCodes = new Set(entries.map(e => e.code.toUpperCase()));
                  const filledCount = item.labs.filter(l => labCodes.has(l.toUpperCase())).length;
                  const totalLabs = item.labs.length;
                  const isOverdue = item.week <= currentWeek && filledCount < totalLabs * 0.8;
                  const isCompleted = filledCount >= totalLabs * 0.8;
                  const isUpcoming = item.week > currentWeek;
                  const borderColor = isCompleted ? 'var(--success)' : isOverdue ? 'var(--danger)' : isUpcoming && item.week <= currentWeek + 2 ? 'var(--warning)' : 'var(--border)';
                  const statusLabel = isCompleted ? 'Пройдено' : isOverdue ? 'Просрочено' : isUpcoming ? 'Предстоит' : '';
                  const statusColor = isCompleted ? 'var(--success)' : isOverdue ? 'var(--danger)' : 'var(--accent)';
                  return (
                    <div key={idx} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, borderLeft: `3px solid ${borderColor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>Неделя {item.week}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, padding: '2px 8px', borderRadius: 6, background: isCompleted ? 'var(--success-dim)' : isOverdue ? 'var(--danger-dim)' : 'var(--accent-dim)' }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{item.reason}</div>
                      <div style={{ fontSize: 12, marginBottom: item.diagnostics.length > 0 ? 6 : 0 }}>
                        <span style={{ fontWeight: 600 }}>Анализы:</span>{' '}
                        {item.labs.map(l => {
                          const filled = labCodes.has(l.toUpperCase());
                          return <span key={l} style={{ display: 'inline-block', margin: '1px 2px', padding: '1px 6px', borderRadius: 4, fontSize: 11, background: filled ? 'var(--success-dim)' : 'var(--bg-tertiary)', color: filled ? 'var(--success)' : 'var(--text-dim)', border: `1px solid ${filled ? 'var(--success)' : 'var(--border)'}` }}>{l}</span>;
                        })}
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>({filledCount}/{totalLabs})</span>
                      </div>
                      {item.diagnostics.length > 0 && (
                        <div style={{ fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>Исследования:</span>{' '}
                          {item.diagnostics.map(d => <span key={d} style={{ display: 'inline-block', margin: '1px 2px', padding: '1px 6px', borderRadius: 4, fontSize: 11, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>{d}</span>)}
                        </div>
                      )}
                      {item.urgency === 'critical' && !isCompleted && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--danger)', fontWeight: 700 }}>&#9888; Критически важно!</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(() => {
            const { labs: drugLabs, diagnostics: drugDiags, reasons } = getDrugSpecificLabs(course);
            if (drugLabs.length === 0 && drugDiags.length === 0) return null;
            return (
              <div className="card" style={{ marginBottom: 12 }}>
                <h3>Препарат-специфичные анализы</h3>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Дополнительные анализы, обусловленные текущими препаратами на курсе:</p>
                {drugLabs.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Маркеры:</span>{' '}
                    {drugLabs.map(l => <span key={l} style={{ display: 'inline-block', margin: '1px 2px', padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'var(--warning-dim)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>{l}</span>)}
                  </div>
                )}
                {drugDiags.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Исследования:</span>{' '}
                    {drugDiags.map(d => <span key={d} style={{ display: 'inline-block', margin: '1px 2px', padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>{d}</span>)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {reasons.map((r, i) => <div key={i} style={{ marginTop: 2 }}>&#8226; {r}</div>)}
                </div>
              </div>
            );
          })()}

          {(() => {
            const status = getCurrentLabStatus(labSchedule, entries.map(e => ({ code: e.code, date: e.date })), currentWeek);
            return (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 12 }}>
                {[
                  { label: 'Просрочено', count: status.overdue.length, color: 'var(--danger)' },
                  { label: 'Предстоит', count: status.upcoming.length, color: 'var(--warning)' },
                  { label: 'Пройдено', count: status.completed.length, color: 'var(--success)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {(() => {
            const drugCorrelationAlerts = analyzeLabDrugCorrelation(entries, course, phase === 'on_cycle' ? 'on_cycle' : phase === 'pct' ? 'pct' : 'baseline');
            if (drugCorrelationAlerts.length === 0) return null;
            return (
              <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid #ef4444' }}>
                <h3 style={{ color: '#ef4444', marginBottom: 8 }}>Взаимодействия препаратов с анализами</h3>
                {drugCorrelationAlerts.map((a, i) => (
                  <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{a.marker} {a.actualStatus === 'high' ? '↑' : '↓'} {a.value.toFixed(1)} {a.unit}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: a.severity === 'critical' ? 'rgba(239,68,68,0.15)' : a.severity === 'high' ? 'rgba(249,115,22,0.15)' : 'rgba(234,179,8,0.15)', color: a.severity === 'critical' ? '#ef4444' : a.severity === 'high' ? '#f97316' : '#eab308' }}>
                        {a.severity === 'critical' ? 'КРИТИЧ.' : a.severity === 'high' ? 'ВЫСОКИЙ' : a.severity === 'med' ? 'СРЕДНИЙ' : 'НИЗКИЙ'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Препараты: {a.drugCause.join(', ')}</div>
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>{a.recommendation}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ожидаемый диапазон: {a.expectedRange[0]}–{a.expectedRange[1]}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {(() => {
            const courseStart = profile?.settings?.courseStartDate;
            if (!courseStart) return null;
            const weeksSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(courseStart).getTime()) / (7 * 24 * 60 * 60 * 1000)));
            const totalWeeks = Math.max(weeksSinceStart + 4, 12);
            const checkpoints = generateCheckpoints(phase as any, courseStart, totalWeeks, { role: 'user' });
            if (checkpoints.length === 0) return null;
            return (
              <div className="card" style={{ marginBottom: 12 }}>
                <h3>Контрольные точки</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {checkpoints.map(cp => {
                    const cpDate = new Date(cp.dueDate);
                    const isPast = cpDate < new Date();
                    return (
                      <div key={cp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{cp.type === 'baseline' ? 'Базовый' : cp.type === 'mid_course' ? 'Середина курса' : cp.type === 'end_of_cycle' ? 'Конец курса' : cp.type === 'pct_start' ? 'Начало ПКТ' : 'Контроль'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>Неделя {cp.weekOffset}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cp.dueDate}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: isPast ? 'var(--success-dim)' : 'var(--warning-dim)', color: isPast ? 'var(--success)' : 'var(--warning)' }}>{isPast ? 'Пройдено' : cp.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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

      {tab === 'risks' && (
        <div className="card">
          <h3>Оценка рисков на основе анализов</h3>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>
                📊
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Нет данных анализов</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                Для расчета лабораторных рисков необходимо ввести результаты анализов.
              </div>
              <button className="btn" style={{ marginTop: 16, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => setTab('input')}>
                ➕ Ввести анализы
              </button>
              <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(234,179,8,0.1)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>
                  ⚠️ Базовые риски показаны без данных анализов
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  Если вы не планируете вводить анализы, нажмите кнопку ниже, чтобы применить штрафные коэффициенты к рискам.
                </p>
                <button className="btn" style={{ 
                  background: profile?.settings?.forceNoLabsPenalty ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)', 
                  color: profile?.settings?.forceNoLabsPenalty ? '#fca5a5' : '#ef4444', 
                  border: '1px solid #ef4444' 
                }} onClick={async () => {
                  if (!profile?.id) return;
                  const { updateProfile } = await import('../../core/profile-manager');
                  await updateProfile(profile.id, {
                    ...profile,
                    settings: {
                      ...profile.settings,
                      forceNoLabsPenalty: !profile.settings?.forceNoLabsPenalty
                    }
                  });
                  notifyDataChange();
                }}>
                  {profile?.settings?.forceNoLabsPenalty ? '✅ Применён штраф (отмена)' : '🚫 БЕЗ АНАЛИЗОВ (Штраф)'}
                </button>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
                  {profile?.settings?.forceNoLabsPenalty ? 'Штрафные коэффициенты применены. Нажмите, чтобы отменить.' : 'Нажмите, чтобы применить штрафные коэффициенты.'}
                </p>
              </div>
            </div>
          ) : risk ? (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Базовый риск</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)' }}>{risk.overallRaw?.toFixed(1) ?? '\u2014'}%</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Скорректированный</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>{risk.overallNet?.toFixed(1) ?? '\u2014'}%</div>
                </div>
              </div>
              <h4>Разбивка по системам:</h4>
              <div style={{ display: 'grid', gap: 8 }}>
                {Object.entries(risk.systemBreakdown || {}).map(([sys, vals]) => (
                  <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, width: 140 }}>{SYSTEM_LABELS[sys] ?? sys}</span>
                    <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 3, height: 8 }}>
                      <div style={{ width: `${Math.min(100, vals.raw ?? 0)}%`, height: '100%', background: 'var(--warning)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--warning)', width: 40, textAlign: 'right' }}>{vals.raw?.toFixed(0) ?? '\u2014'}%</span>
                    <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 3, height: 8 }}>
                      <div style={{ width: `${Math.min(100, vals.net ?? 0)}%`, height: '100%', background: 'var(--success)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--success)', width: 40, textAlign: 'right' }}>{vals.net?.toFixed(0) ?? '\u2014'}%</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                <h4 style={{ margin: '0 0 8px' }}>Вклад анализов в риск:</h4>
                {Object.entries(labRisks || {}).map(([sys, val]) => (
                  <div key={sys} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{SYSTEM_LABELS[sys] ?? sys}</span>
                    <span style={{ color: (val as number) > 30 ? 'var(--danger)' : 'var(--success)' }}>{(val as number).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-dim)' }}>Для расчёта рисков необходимо добавить результаты анализов и данные о курсе.</p>
          )}
        </div>
      )}

      {tab === 'investigations' && (
        <div className="card">
          <h3>Исследования и обследования</h3>
          <p style={{ color: 'var(--text-dim)', marginBottom: 12 }}>Инструментальные и аппаратные исследования для мониторинга на курсе и в ПКТ</p>

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { id: 'echo_kg', name: 'ЭХО-КГ (эхокардиография)', system: 'cardio', freq: 'Каждые 8 нед на курсе; перед курсом и после ПКТ', markers: 'Фракция выброса ЛЖ, толщина стенок миокарда, клапаны, диастолическая функция, АДЛА, давление в ЛА', reason: 'ААС вызывают гипертрофию миокарда, диастолическую дисфункцию, изменения клапанов. ЭХО-КГ — золотой стандарт мониторинга.' },
              { id: 'ekg', name: 'ЭКГ (электрокардиограмма)', system: 'cardio', freq: 'Каждые 4 нед на курсе', markers: 'QTc, гипертрофия ЛЖ, аритмии, ишемия, блокады', reason: 'Ранняя диагностика аритмий (пролонгация QT), признаков гипертрофии и ишемии. Доступно и информативно.' },
              { id: 'usg_abd', name: 'УЗИ органов брюшной полости', system: 'hepatic', freq: 'Перед курсом, на 4-й нед, после ПКТ', markers: 'Размер и эхогенность печени, жёлчный пузырь, поджелудочная, селезёнка, почки, надпочечники', reason: 'Стеатоз, гепатомегалия, холестаз, кисты, исключение опухолей. Обязательное базовое обследование.' },
              { id: 'usg_kidney', name: 'УЗИ почек и мочевыводящих путей', system: 'renal', freq: 'Перед курсом, при повышении креатинина', markers: 'Размер почек, кортикальный слой, ЧЛС, конкременты, скорость клубочковой фильтрации (расчёт)', reason: 'Тренболон и другие ААС — нефротоксичность. Ранняя диагностика структурных изменений.' },
              { id: 'usg_prostate', name: 'УЗИ простаты (ТРУЗИ)', system: 'reproductive', freq: 'Перед курсом и после ПКТ (мужчины)', markers: 'Объём простаты, структура, PSA-зоны, конкременты', reason: 'ААС (особенно тестостерон) вызывают гиперплазию простаты. Мониторинг обязателен при >30 лет.' },
              { id: 'usg_thyroid', name: 'УЗИ щитовидной железы', system: 'endocrine', freq: 'Перед курсом (базовое), при симптомах', markers: 'Объём, структура, узлы, кровоток, лимфоузлы', reason: 'ААС подавляют HPT-ось. Сверхзаместительные дозы тестостерона снижают TSH. Базовое УЗИ обязательно.' },
              { id: 'usg_heart_24h', name: 'Холтер-ЭКГ (24ч мониторинг)', system: 'cardio', freq: 'При симптомах аритмии на курсе', markers: 'Суточная ЧСС, эпизоды тахикардии/брадикардии, паузы, желудочковые экстрасистолы, ST-депрессия', reason: 'Тренболон, кленбутерол, Т3 — высокий риск аритмий. Холтер — единственный способ поймать пароксизмальные нарушения.' },
              { id: 'mri_brain', name: 'МРТ головного мозга', system: 'neuro', freq: 'При стойких головных болях, зрительных нарушениях', markers: 'Гипофиз (макро/микроаденома), белое вещество, сосуды, объём', reason: 'ААС угнетают ось ГГЯ → гиперинсулинемия → риск аденомы гипофиза. МРТ — при упорных симптомах.' },
              { id: 'densitometry', name: 'Денситометрия (DEXA)', system: 'musculoskeletal', freq: 'Базовое; через 6 мес курса', markers: 'Минеральная плотность кости (T-score, Z-score), композиция тела', reason: 'ААС в ПКТ-периоде (гипогонадизм) → риск остеопении. Дексаметазон, ароматаза-ингибиторы дополнительно снижают BMD.' },
              { id: 'usg_joints', name: 'УЗИ суставов', system: 'musculoskeletal', freq: 'При боли/хрусте в суставах', markers: 'Синовиальная жидкость, хрящ (толщина), мениски, связки, сухожилия, воспаление', reason: 'Тренболон и Винстрол — риск сухости суставов и повреждения связок. УЗИ позволяет оценить структурные изменения.' },
              { id: 'spirometry', name: 'Спирометрия', system: 'cardio', freq: 'Базовое; при одышке на курсе', markers: 'FEV1, FVC, FEV1/FVC (индекс Тиффно), PEF', reason: 'Оральный прием ААС (17-альфа-алкилированные) могут вызывать реактивность дыхательных путей. Контроль при симптомах.' },
              { id: 'abd_ct', name: 'КТ органов брюшной полости', system: 'hepatic', freq: 'При подозрении на опухоль по УЗИ', markers: 'Очаговые образования печени, adrenal incidentaloma, лимфаденопатия', reason: 'Уточняющий метод при находках УЗИ. ААС теоретически повышают риск гепатоцеллюлярной аденомы.' },
              { id: 'ambp', name: 'СМАД (24ч мониторинг АД)', system: 'cardio', freq: 'Каждые 4 нед на курсе при ААС-индуцированной гипертензии', markers: 'Среднее систолическое/диастолическое, суточный индекс, утренний подъём, нагрузка давлением', reason: 'ААС повышают АД через ренин-ангиотензин, объём, вазоконстрикцию. СМАД точнее разовых измерений.' },
            ].map(inv => {
              const isDone = invDone[inv.id] ?? false;
              return (
                <div key={inv.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, border: isDone ? '1px solid var(--success)' : '1px solid var(--border)', transition: 'all .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: isDone ? 'var(--success)' : 'var(--text)', marginBottom: 2 }}>{inv.name}</div>
                      <div style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)', display: 'inline-block', marginBottom: 4 }}>{SYSTEM_LABELS[inv.system] ?? inv.system}</div>
                    </div>
                    <button onClick={() => setInvDone(p => ({ ...p, [inv.id]: !p[inv.id] }))} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      background: isDone ? 'var(--success-dim)' : 'var(--bg-tertiary)',
                      color: isDone ? 'var(--success)' : 'var(--text-dim)',
                      border: isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                    }}>
                      {isDone ? 'Пройдено ✓' : 'Не пройдено'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 3 }}><b>Частота:</b> {inv.freq}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}><b>Параметры:</b> {inv.markers}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>{inv.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
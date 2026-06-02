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
import { resolveLabMarker, interpretRatio, normalizedRatio } from '../../core/labs-mapping';
import { computeLabIndices, interpretLabIndices } from '../../engines/labs-indices.engine';
import { PHASE_REQUIRED_PANELS, LAB_PANELS } from '../../data/labs-phase-panels';
import type { LabPoint, UserProfile, RiskResult, CourseEntry } from '../../core/types';

export const LabsScreen: React.FC = () => {
  const [form, setForm] = useState<{ code: string; value: string; unit: string; date: string }>({
    code: '',
    value: '',
    unit: '',
    date: ''
  });
  const [swipeState, setSwipeState] = useState<{ x: number | null; y: number | null; direction: string | null }>({
    x: null,
    y: null,
    direction: null
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [trend, setTrend] = useState<{ current: number; forecast: number; slope: number; alert?: string } | null>(null);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [entries, setEntries] = useState<LabPoint[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labItemRef = useRef<HTMLDivElement>(null);
  const [labIndices, setLabIndices] = useState({ inflammation: 0, metabolism: 0, thyroid: 0, lipids: 0 });
  const [labIndexText, setLabIndexText] = useState({ inflammation: '', metabolism: '', thyroid: '', lipids: '' });
  const [phase, setPhase] = useState<'baseline' | 'course' | 'pct' | 'maintenance'>('baseline');
  const [requiredPanels, setRequiredPanels] = useState<string[]>([]);
  const [selectedLabIndex, setSelectedLabIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (profile?.settings?.phase) {
      setPhase(profile.settings.phase as 'baseline' | 'course' | 'pct' | 'maintenance');
      setRequiredPanels(PHASE_REQUIRED_PANELS[profile.settings.phase] ?? PHASE_REQUIRED_PANELS.baseline);
    } else {
      setPhase('baseline');
      setRequiredPanels(PHASE_REQUIRED_PANELS.baseline);
    }
  }, [profile?.settings?.phase]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setSwipeState({
        x: touch.clientX,
        y: touch.clientY,
        direction: null
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeState.x !== null && swipeState.y !== null && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const diffX = touch.clientX - swipeState.x;
      const diffY = touch.clientY - swipeState.y;
      const minDistance = 50;
      if (Math.abs(diffX) > minDistance || Math.abs(diffY) > minDistance) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 0) {
            setSwipeState({ ...swipeState, direction: 'right' });
            handleSwipeRight();
          } else {
            setSwipeState({ ...swipeState, direction: 'left' });
            handleSwipeLeft();
          }
        } else {
          if (diffY > 0) {
            setSwipeState({ ...swipeState, direction: 'down' });
            handleSwipeDown();
          } else {
            setSwipeState({ ...swipeState, direction: 'up' });
            handleSwipeUp();
          }
        }
      }
    }
  };

  const sortedLabs = React.useMemo(() => {
    const codes = [...new Set(entries.map(e => e.code))];
    codes.sort();
    return codes;
  }, [entries]);

  const handleSwipeLeft = () => {
    if (sortedLabs.length === 0) return;
    setSelectedLabIndex((prev) => (prev + 1) % sortedLabs.length);
    setShowDetails(false);
  };

  const handleSwipeRight = () => {
    if (sortedLabs.length === 0) return;
    setSelectedLabIndex((prev) => (prev - 1 + sortedLabs.length) % sortedLabs.length);
    setShowDetails(false);
  };

  const handleSwipeUp = () => {
    setShowDetails(true);
  };

  const handleSwipeDown = () => {
    setShowDetails(false);
  };

  useEffect(() => {
    if (sortedLabs.length > 0) {
      setSelected(sortedLabs[selectedLabIndex] ?? sortedLabs[0]);
    }
  }, [selectedLabIndex, sortedLabs]);

  useEffect(() => {
    if (labItemRef.current) {
      labItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selected]);

  useEffect(() => {
    if (entries.length > 0) {
      const indices = computeLabIndices(entries);
      setLabIndices(indices);
      setLabIndexText(interpretLabIndices(indices));
    } else {
      setLabIndices({ inflammation: 0, metabolism: 0, thyroid: 0, lipids: 0 });
      setLabIndexText({ inflammation: '', metabolism: '', thyroid: '', lipids: '' });
    }
  }, [entries]);

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
    const loadData = async () => {
      try {
        await db.init();
        const prof = await db.get<UserProfile>('profile', 'current-user');
        setProfile(
          prof ?? {
            id: 'current-user',
            name: 'Current User',
            role: 'user',
            settings: {
              age: 30,
              sex: 'male',
              weight: 70,
              goal: 'muscle gain',
              phase: 'baseline',
              courseStartDate: new Date().toISOString().slice(0, 10),
              height: 180,
              bodyFat: 15
            }
          }
        );
        const courseEntries = await db.getAll<CourseEntry>('course_log');
        setCourse(courseEntries);
        const labEntries = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
        const userLabs = labEntries.filter((l) => l.patientId === 'current-user');
        setEntries(userLabs);
        if (userLabs.length > 0) {
          const latest = userLabs.reduce((a, b) => (a.date > b.date ? a : b));
          setSelected((prev) => prev ?? latest.code);
        }
      } catch (e) {
        console.error('Failed to load initial data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const drawChart = async () => {
      if (!selected || !canvasRef.current) return;
      const pts = await getLabHistory('current-user', selected);
      if (pts.length >= 2) {
        const ucum = UCUM_MAP[selected];
        if (!ucum) return;
        const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date));
        const baseDate = new Date(sorted[0].date);
        const chartData = sorted.map((p) => {
          const date = new Date(p.date);
          const weeks = (date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
          return { week: weeks, value: p.value, isAbnormal: false };
        });
        drawLabTrend(canvasRef.current, chartData, ucum.uln, ucum.lln, ucum.prefUnit, ucum.name);
      } else {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
    drawChart();
  }, [selected, entries]);

  const refreshTrend = async (codeOverride?: string) => {
    const activeCode = codeOverride ?? selected;
    if (!activeCode || !canvasRef.current) return;
    const pts = await getLabHistory('current-user', activeCode);
    if (pts.length >= 2) {
      const ucum = UCUM_MAP[activeCode];
      if (!ucum) return;
      const trendData = await getLabTrend('current-user', activeCode);
      setTrend(trendData);
      const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date));
      const baseDate = new Date(sorted[0].date);
      const chartData = sorted.map((p) => {
        const date = new Date(p.date);
        const weeks = (date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
        return { week: weeks, value: p.value, isAbnormal: false };
      });
      drawLabTrend(canvasRef.current, chartData, ucum.uln, ucum.lln, ucum.prefUnit, ucum.name);
    } else {
      setTrend(null);
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const calculateUserRisks = async () => {
    if (!profile) return;
    try {
      const genetics: Record<string, string> = profile.settings?.genetics ?? {};
      const nutritionFactor = profile.settings?.nutritionFactor ?? 1.0;
      const trainingFactor = profile.settings?.trainingFactor ?? 1.0;

      const activeDrugs: Record<string, { dosePerWeek: number }> = {};
      course.forEach((entry) => {
        const freq =
          typeof entry.frequency === 'number'
            ? entry.frequency
            : entry.frequency === 'daily'
              ? 7
              : entry.frequency === 'eod'
                ? 3.5
                : 1;
        activeDrugs[entry.substanceId] = { dosePerWeek: entry.doseValue * freq };
      });

      const courseRisksResult = calculateRisks({
        genetics,
        nutritionFactor,
        trainingFactor,
        activeDrugs,
        supportCoverage: {}
      });
      const courseRawRisks: Record<string, number> = {};
      Object.keys(courseRisksResult.systemBreakdown || {}).forEach((sys) => {
        courseRawRisks[sys] = courseRisksResult.systemBreakdown![sys].raw;
      });

      const labRisks = calculateRiskFromAnalyses(entries);
      const labRawRisks: Record<string, number> = {};
      RISK_SYSTEMS.forEach((s) => {
        labRawRisks[s] = 0;
      });
      if (labRisks.systemContributions.hepatic !== undefined) labRawRisks.hepatic = labRisks.systemContributions.hepatic;
      if (labRisks.systemContributions.renal !== undefined) labRawRisks.renal = labRisks.systemContributions.renal;
      labRawRisks.endocrine = Math.max(labRisks.systemContributions.endocrine || 0, labRisks.systemContributions.cardio || 0);

      const combinedRawRisks: Record<string, number> = {};
      RISK_SYSTEMS.forEach((sys) => {
        combinedRawRisks[sys] = Math.max(courseRawRisks[sys] || 0, labRawRisks[sys] || 0);
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
      const finalRisks = calculateRisks({
        genetics,
        nutritionFactor,
        trainingFactor,
        activeDrugs,
        supportCoverage: coverageMap
      });
      setRisk(finalRisks);
    } catch (e) {
      console.error('Failed to calculate risks:', e);
    }
  };

  useEffect(() => {
    calculateUserRisks();
  }, [entries, profile, course]);

  const add = async () => {
    if (!form.code || !form.value || !form.unit) return;
    const val = parseFloat(form.value);
    if (Number.isNaN(val)) return;
    const code = resolveLabMarker(form.code);
    const point: LabPoint = {
      id: Math.random().toString(36).slice(2, 11),
      code,
      name: code,
      value: val,
      unit: form.unit.toUpperCase(),
      date: form.date || new Date().toISOString().slice(0, 10),
      phase: profile?.settings?.phase ?? 'baseline',
      patientId: 'current-user'
    };
    try {
      await addLabPoint('current-user', point);
      setEntries((prev) => [...prev, point]);
      setForm((prev) => ({ ...prev, value: '', unit: '' }));
      if (selected === point.code) await refreshTrend(point.code);
      await calculateUserRisks();
    } catch (e) {
      console.error('Failed to add lab point:', e);
    }
  };

  const importFromText = async () => {
    const parsed = parseLabText(ocrText);
    if (!parsed.length) return;
    for (const row of parsed) {
      const code = resolveLabMarker(row.marker);
      const point: LabPoint = {
        id: Math.random().toString(36).slice(2, 11),
        code,
        name: code,
        value: row.value,
        unit: row.unit,
        date: form.date || new Date().toISOString().slice(0, 10),
        phase: profile?.settings?.phase ?? 'baseline',
        patientId: 'current-user'
      };
      await addLabPoint('current-user', point);
      setEntries((prev) => [...prev, point]);
      if (row.refRange) {
        console.log(`Reference range found for ${code}: ${row.refRange}`);
      }
    }
    setOcrText('');
    await calculateUserRisks();
  };

  const getLatestEntry = (codes: string[]) => {
    const set = new Set(codes.map(c => c.toUpperCase()));
    const filtered = entries.filter(e => set.has(e.code.toUpperCase()));
    if (!filtered.length) return null;
    return filtered.sort((a, b) => b.date.localeCompare(a.date))[0];
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div
      className="screen labs"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <h2>Лабораторные анализы</h2>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Импорт результатов анализа</h3>
        <textarea
          className="input"
          rows={4}
          placeholder="Вставьте текст лабораторного анализа: например, Гемоглобин 140 г/л, Холестерин общий 5.2 ммоль/л..."
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <button type="button" className="btn" onClick={importFromText}>
          Распознать и добавить
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>Рекомендуемые показатели для текущей фазы: {phase}</h3>
        <ul style={{ fontSize: 13 }}>
          {requiredPanels.map((panelId) => (
            <li key={panelId}>
              {LAB_PANELS[panelId]?.label ?? panelId}:{' '}
              {(LAB_PANELS[panelId]?.markers ?? []).map((m) => m.ucumCode ?? m.id).join(', ')}
            </li>
          ))}
        </ul>
      </div>

      <div className="lab-input">
        <input
          placeholder="Название или код показателя (例如: Гемоглобин, HGB, Креатинин)"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: resolveLabMarker(e.target.value) })}
          className="input"
        />
        <input
          placeholder="Измеренное значение"
          type="number"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          className="input"
        />
        <input
          placeholder="Единица измерения (например: г/л, ммоль/л, %)"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value.toUpperCase() })}
          className="input"
        />
        <input
          placeholder="Дата взятия анализа"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="input"
        />
        <button onClick={add} className="btn">
          Сохранить результат
        </button>
      </div>

      {selected && (
        <div className="lab-details">
          <h3>Динамика показателя: {selected}</h3>
          <table className="lab-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Значение</th>
                <th>Единица</th>
                <th>Норма (референтные значения)</th>
                <th>Оценка</th>
              </tr>
            </thead>
            <tbody>
              {entries
                .filter((e) => e.code === selected)
                .map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.value}</td>
                    <td>{e.unit}</td>
                    <td>{getNormUnit(e.code, e.value, e.unit)}</td>
                    <td>{interpretRatio(ratioForPoint(e))}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {showDetails && entries.filter((e) => e.code === selected).length >= 2 && (
            <div className="lab-trend">
              <h4>График изменений за последние 12 недель</h4>
              <canvas ref={canvasRef} width={400} height={140} />
            </div>
          )}
          {showDetails && trend && (
            <div className="lab-trend-details">
              <p>Последнее значение: {trend.current}</p>
              <p>Прогнозируемое значение: {trend.forecast}</p>
              <p>Тренд изменения: {trend.slope.toFixed(4)}</p>
              {trend.alert && <p className="alert">{trend.alert}</p>}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Индексы гормонального баланса</h3>
        <ul>
          <li>
            Воспалительные процессы: {labIndexText.inflammation} ({(labIndices.inflammation * 100).toFixed(0)}%)
          </li>
          <li>
            Метаболический статус: {labIndexText.metabolism} ({(labIndices.metabolism * 100).toFixed(0)}%)
          </li>
          <li>
            Функция щитовидной железы: {labIndexText.thyroid} ({(labIndices.thyroid * 100).toFixed(0)}%)
          </li>
          <li>
            Липидный профиль и риск атеросклероза: {labIndexText.lipids} ({(labIndices.lipids * 100).toFixed(0)}%)
          </li>
        </ul>
      </div>

      {/* Labs-Nutrition Connection Enhancement */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Связь лабораторных показателей с нутрициологией</h3>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {/* Metabolic Health Panel */}
          <div className="card" style={{ padding: 12 }}>
            <h4>Метаболическое здоровье</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Глюкоза натощак:</span>
              {(() => {
                const point = getLatestEntry(['GLU', 'GLUCOSE']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                const ratio = ratioForPoint(point);
                const isLow = ratio !== null && ratio < 0.4;
                return (
                  <span>
                    {normStr}{' '}
                    {isLow ? (
                      <span style={{ color: 'var(--danger)' }}>(низкая)</span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>(нормальная)</span>
                    )}
                  </span>
                );
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Инсулин:</span>
              {(() => {
                const point = getLatestEntry(['INS']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>HOMA-IR:</span>
              {(() => {
                const glucosePoint = getLatestEntry(['GLU', 'GLUCOSE']);
                const insulinPoint = getLatestEntry(['INS']);
                if (!glucosePoint || !insulinPoint) return <span>—</span>;
                const glucoseNorm = normalizeLab(glucosePoint.code, glucosePoint.value, glucosePoint.unit);
                const insulinNorm = normalizeLab(insulinPoint.code, insulinPoint.value, insulinPoint.unit);
                if (glucoseNorm.norm === null || insulinNorm.norm === null) return <span>—</span>;
                const homaIr = (glucoseNorm.norm * insulinNorm.norm) / 22.5;
                return <span>{homaIr.toFixed(2)}</span>;
              })()}
            </div>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <p><strong>Питательные рекомендации:</strong></p>
              <ul style={{ margin: '6px 0 0 20px', fontSize: 11, paddingLeft: 0 }}>
                <li>Снизить простые углеводы и сахара</li>
                <li>Увеличить потребление клетчатки (овощи, бобовые, цельные зёрна)</li>
                <li>Добавить белок в каждый приём пищи</li>
                <li>Рассмотреть интервальное голодание 12-16 часов</li>
              </ul>
            </div>
          </div>

          {/* Lipid Panel */}
          <div className="card" style={{ padding: 12 }}>
            <h4>Липидный профиль</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Общий холестерин:</span>
              {(() => {
                const point = getLatestEntry(['CHOL', 'TCHOL', 'CHOLESTEROL']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>ЛПВП (хороший холестерин):</span>
              {(() => {
                const point = getLatestEntry(['HDL']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>ЛПНП (плохой холестерин):</span>
              {(() => {
                const point = getLatestEntry(['LDL']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Триглицериды:</span>
              {(() => {
                const point = getLatestEntry(['TG']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <p><strong>Питательные рекомендации:</strong></p>
              <ul style={{ margin: '6px 0 0 20px', fontSize: 11, paddingLeft: 0 }}>
                <li>Заменить насыщенные жиры на моно- и полиненасыщенные</li>
                <li>Увеличить потребление омега-3 (рыба, льняное семя, грецкие орехи)</li>
                <li>Уменьшить рафинированные углеводы и алкоголь</li>
                <li>Добавить растворимую клетчатку (овёс, бобовые, яблоки)</li>
              </ul>
            </div>
          </div>

          {/* Liver & Detox Panel */}
          <div className="card" style={{ padding: 12 }}>
            <h4>Печень и детоксикация</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>АЛТ:</span>
              {(() => {
                const point = getLatestEntry(['ALT']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>АСТ:</span>
              {(() => {
                const point = getLatestEntry(['AST']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>GGT:</span>
              {(() => {
                const point = getLatestEntry(['GGT']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Билирубин:</span>
              {(() => {
                const point = getLatestEntry(['BILI', 'BILIRUBIN']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <p><strong>Питательные рекомендации:</strong></p>
              <ul style={{ margin: '6px 0 0 20px', fontSize: 11, paddingLeft: 0 }}>
                <li>Уменьшить потребление обработанных продуктов и алкоголя</li>
                <li>Увеличить крестоцветные овощи (брокколи, цветная капуста, капуста)</li>
                <li>Добавить продукты rich in серу (чеснок, лук, яйца)</li>
                <li>Рассмотреть добавки: N-ацетилцистеин, куркумин, магний</li>
              </ul>
            </div>
          </div>

          {/* Inflammation Panel */}
          <div className="card" style={{ padding: 12 }}>
            <h4>Воспалительные маркеры</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>СРБ (C-реактивный белок):</span>
              {(() => {
                const point = getLatestEntry(['CRP']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Ферритин:</span>
              {(() => {
                const point = getLatestEntry(['FERRITIN']);
                if (!point) return <span>—</span>;
                const normStr = getNormUnit(point.code, point.value, point.unit);
                return <span>{normStr}</span>;
              })()}
            </div>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <p><strong>Питательные рекомендации:</strong></p>
              <ul style={{ margin: '6px 0 0 20px', fontSize: 11, paddingLeft: 0 }}>
                <li>Увеличить потребление омега-3 жирных кислот</li>
                <li>Добавить яркие фрукты и овощи (антиоксиданты)</li>
                <li>Рассмотреть куркумин с черным перцем для лучшего усвоения</li>
                <li>Уменьшить рафинированные углеводы и трансжиры</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="lab-risks">
        <h3>Комплексная оценка рисков для здоровья</h3>
        {risk ? (
          <div>
            <p>Общий базовый риск: {risk.overallRaw?.toFixed?.(2) ?? '\u2014'}%</p>
            <p>Общий скорректированный риск (с учетом поддержки): {risk.overallNet?.toFixed?.(2) ?? '\u2014'}%</p>
            <h4>Детальная разбивка по органам и системам:</h4>
            <ul>
              {Object.entries(risk.systemBreakdown || {}).map(([sys, vals]) => (
                <li key={sys}>
                  {sys}: Риск без коррекции {vals.raw?.toFixed?.(2) ?? '\u2014'}%, Риск с коррекцией {vals.net?.toFixed?.(2) ?? '\u2014'}%
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Для расчета рисков необходимо добавить результаты лабораторных анализов</p>
        )}
      </div>

      {/* Specific analysis for ketogenic, hypoglycemia, hypolipidemia */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Специфический анализ состояний</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {/* Ketone Bodies */}
          <div className="card" style={{ padding: 12 }}>
            <h4>Кетоновые тела</h4>
            {[
              { code: 'BHB', name: 'Бетта-гидроксибутират' },
              { code: 'ACETOACETATE', name: 'Ацетоуксусная кислота' },
              { code: 'ACETONE', name: 'Ацетон' }
            ].map((ketone) => {
              const ketoneEntries = entries.filter((e) => e.code === ketone.code);
              if (ketoneEntries.length === 0) {
                return <div key={ketone.code} style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {ketone.name}: не обнаружено
                </div>;
              }
              const latest = ketoneEntries.reduce((a, b) => (a.date > b.date ? a : b));
              const ratio = normalizedRatio(latest.code, latest.value, latest.unit);
              const isAboveNormal = ratio !== null && ratio > 1.0;
              return (
                <div key={ketone.code} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{ketone.name}:</span>
                  <span>
                    {latest.value} {latest.unit}{' '}
                    {isAboveNormal ? (
                      <span style={{ color: 'var(--danger)' }}>(выше нормы)</span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>(норма)</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hypoglycemia */}
          <div className="card" style={{ padding: 12 }}>
            <h4>Гипогликемия</h4>
            {(() => {
              const glucoseEntries = entries.filter((e) => e.code === 'GLU' || e.code === 'GLUCOSE');
              if (glucoseEntries.length === 0) {
                return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Глюкоза: не измерена</div>;
              }
              const latestGlucose = glucoseEntries.reduce((a, b) => (a.date > b.date ? a : b));
              const glucoseRatio = normalizedRatio(latestGlucose.code, latestGlucose.value, latestGlucose.unit);
              const isLow = glucoseRatio !== null && glucoseRatio < 0.4;
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Глюкоза:</span>
                  <span>
                    {latestGlucose.value} {latestGlucose.unit}{' '}
                    {isLow ? (
                      <span style={{ color: 'var(--danger)' }}>(низкая)</span>
                    ) : (
                      <span style={{ color: 'var(--success)' }}>(нормальная)</span>
                    )}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Hypolipidemia */}
          <div className="card" style={{ padding: 12 }}>
            <h4>Гиполипидемия</h4>
            {(() => {
              if (labIndices === undefined || labIndices.lipids === undefined) {
                return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Липидный индекс: нет данных</div>;
              }
              const lipidsIndex = labIndices.lipids;
              return lipidsIndex < 0.3 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Липидный индекс:</span>
                  <span>
                    {(lipidsIndex * 100).toFixed(0)}%{' '}
                    <span style={{ color: 'var(--danger)' }}>(низкий)</span>
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Липидный индекс:</span>
                  <span>
                    {(lipidsIndex * 100).toFixed(0)}%{' '}
                    <span style={{ color: 'var(--success)' }}>(нормальный)</span>
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { PHARMA_DB, SUBSTANCES_BY_CLASS } from '../../core/pharma-database';
import { validateCourse } from '../../engines/pharmacology.engine';
import { checkDrugInteractions } from '../../engines/pharma-interactions.engine';
import { generatePCTPlan } from '../../engines/pct-planner.engine';
import { generateWeeklyProtocol } from '../../engines/auto-plan.engine';
import { db } from '../../core/db';
import { notifyDataChange } from '../../core/data-link';
import type { CourseEntry } from '../../core/types';

const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон', trenbolone: 'Тренболон', nandrolone: 'Нандролон',
  boldenone: 'Болденон', primobolan: 'Примоболан', oral_17aa: 'Оральные 17-αА',
  sarm: 'SARMs', peptide_ghrh: 'Пептиды GHRH', peptide_ghrp: 'Пептиды GHRP',
  igf1: 'IGF-1', mgf: 'MGF', insulin: 'Инсулины',
  pct_serm: 'ПКТ SERM', pct_aromatase: 'ПКТ АИ', pct_dopamine: 'ПКТ ДА',
  support: 'Поддержка'
};

const FREQ_LABELS: Record<string, string> = {
  '1x/wk': '1 раз/нед', '2x/wk': '2 раза/нед', '3x/wk': '3 раза/нед',
  'eod': 'Через день', 'daily': 'Ежедневно'
};

export const PharmaCourseScreen: React.FC = () => {
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [selectedClass, setSelectedClass] = useState('testosterone');
  const [selectedSub, setSelectedSub] = useState('');
  const [dose, setDose] = useState('');
  const [unit, setUnit] = useState('mg/wk');
  const [freq, setFreq] = useState('2x/wk');
  const [startWeek, setStartWeek] = useState(0);
  const [endWeek, setEndWeek] = useState(12);
  const [pctPlan, setPctPlan] = useState<ReturnType<typeof generatePCTPlan> | null>(null);
  const [interactions, setInteractions] = useState<ReturnType<typeof checkDrugInteractions>>([]);
  const [validation, setValidation] = useState<{ valid: boolean; warnings: string[] }>({ valid: true, warnings: [] });
  const [autoProtocol, setAutoProtocol] = useState<ReturnType<typeof generateWeeklyProtocol> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        await db.init();
        const entries = await db.getAll<CourseEntry>('course_log');
        setCourse(entries);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    const subs = SUBSTANCES_BY_CLASS[selectedClass];
    if (subs?.length) setSelectedSub(subs[0].id);
  }, [selectedClass]);

  useEffect(() => {
    if (course.length) {
      setValidation(validateCourse(course));
      setInteractions(checkDrugInteractions(course));
    } else {
      setValidation({ valid: true, warnings: [] });
      setInteractions([]);
    }
  }, [course]);

  const addEntry = async () => {
    const d = parseFloat(dose);
    if (!selectedSub || isNaN(d) || d <= 0) return;
    const entry: CourseEntry = {
      id: crypto.randomUUID(),
      substanceId: selectedSub,
      doseValue: d,
      doseUnit: unit,
      frequency: freq,
      startWeek,
      endWeek
    };
    try {
      await db.put('course_log', entry);
      setCourse(prev => [...prev, entry]);
      setDose('');
      notifyDataChange();
    } catch (e) { console.error(e); }
  };

  const removeEntry = async (id: string) => {
    try {
      await db.delete('course_log', id);
      setCourse(prev => prev.filter(e => e.id !== id));
      notifyDataChange();
    } catch (e) { console.error(e); }
  };

  const buildPCT = () => {
    if (!course.length) return;
    const plan = generatePCTPlan(course, Math.max(...course.map(c => c.endWeek)));
    setPctPlan(plan);
  };

  const subName = (id: string) => PHARMA_DB[id]?.name ?? id;

  if (loading) return <div className="loading-screen"><div className="loading-spinner"/><span>Загрузка...</span></div>;

  const subsForClass = SUBSTANCES_BY_CLASS[selectedClass] ?? [];

  return (
    <div className="screen pharma-course">
      <h2>Мой курс</h2>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>&#128138; Добавить препарат</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {Object.entries(CLASS_LABELS).map(([cls, label]) => {
            const hasSubs = SUBSTANCES_BY_CLASS[cls]?.length > 0;
            if (!hasSubs) return null;
            return (
              <button key={cls} className={'btn secondary' + (selectedClass === cls ? ' active' : '')}
                style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setSelectedClass(cls)}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select className="input" value={selectedSub} onChange={e => setSelectedSub(e.target.value)}>
            {subsForClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="number" className="input" placeholder="Дозировка" value={dose} onChange={e => setDose(e.target.value)} />
          <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="mg/wk">мг/нед</option>
            <option value="mg/day">мг/день</option>
            <option value="IU/wk">МЕ/нед</option>
            <option value="IU/day">МЕ/день</option>
            <option value="mcg/day">мкг/день</option>
          </select>
          <select className="input" value={freq} onChange={e => setFreq(e.target.value)}>
            {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Нед:</span>
            <input type="number" className="input" style={{ width: 50 }} value={startWeek} onChange={e => setStartWeek(parseInt(e.target.value) || 0)} min={0} />
            <span style={{ fontSize: 12 }}>—</span>
            <input type="number" className="input" style={{ width: 50 }} value={endWeek} onChange={e => setEndWeek(parseInt(e.target.value) || 12)} min={1} />
          </div>
        </div>
        <button className="btn" style={{ marginTop: 8, width: '100%' }} onClick={addEntry} disabled={!selectedSub || !dose}>
          &#10010; Добавить в курс
        </button>
      </div>

      {course.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Текущий курс ({course.length} препаратов)</h3>
            <button className="btn secondary" style={{ fontSize: 12 }} onClick={buildPCT}>&#128203; Сформировать ПКТ</button>
          </div>

          {!validation.valid && validation.warnings.length > 0 && (
            <div style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)', borderRadius: 8, padding: 10, marginTop: 8 }}>
              {validation.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warning)' }}>&#9888; {w}</div>)}
            </div>
          )}

          {validation.valid && (
            <div style={{ background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 8, padding: 10, marginTop: 8, fontSize: 12, color: 'var(--success)' }}>
              &#10003; Курс валиден
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {course.map(entry => {
              const sub = PHARMA_DB[entry.substanceId];
              return (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{subName(entry.substanceId)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {entry.doseValue} {entry.doseUnit} · {FREQ_LABELS[entry.frequency as string] ?? entry.frequency} · нед. {entry.startWeek}–{entry.endWeek}
                    </div>
                  </div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }} onClick={() => removeEntry(entry.id)}>&#10005;</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {interactions.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>&#9888; Взаимодействия препаратов</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {interactions.map((a, i) => (
              <div key={i} style={{ background: a.type === 'critical' ? 'var(--danger-dim)' : 'var(--warning-dim)', border: `1px solid ${a.type === 'critical' ? 'var(--danger)' : 'var(--warning)'}`, borderRadius: 8, padding: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: a.type === 'critical' ? 'var(--danger)' : 'var(--warning)' }}>
                  {a.type === 'critical' ? '&#128308; Критическое' : '&#128992; Умеренное'}: {a.drugs.join(' + ')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{a.mechanism}</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>&#128161; {a.recommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pctPlan && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>&#128203; План ПКТ</h3>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Начало ПКТ: неделя {pctPlan.pctStartWeek} ({pctPlan.startDate})
          </div>
          {pctPlan.warnings.length > 0 && (
            <div style={{ background: 'var(--warning-dim)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              {pctPlan.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warning)' }}>{w}</div>)}
            </div>
          )}
          <h4 style={{ margin: '8px 0 4px' }}>Протокол ПКТ:</h4>
          {pctPlan.pctProtocol.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span>{p.drug}</span>
              <span style={{ color: 'var(--text-dim)' }}>{p.dose} · {p.durationWeeks} нед.</span>
            </div>
          ))}
          <h4 style={{ margin: '8px 0 4px' }}>Поддержка:</h4>
          {pctPlan.supportStack.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span>{s.name}</span>
              <span style={{ color: 'var(--text-dim)' }}>{s.dose} · {s.durationWeeks} нед.</span>
            </div>
          ))}
        </div>
      )}

      {course.length > 0 && !autoProtocol && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>&#128197; Авто-протокол</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Генерация расписания приёмов на неделю с учётом лаб-корректировок и взаимодействий</p>
          <button onClick={() => {
            const goalId = course.some(c => c.substanceId.includes('test')) ? 'mass_gain' : 'health';
            const protocol = generateWeeklyProtocol(goalId, [], [], undefined, course.some(c => c.substanceId.includes('test')) ? 'course' : 'baseline', []);
            setAutoProtocol(protocol);
          }} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            Сгенерировать недельный протокол
          </button>
        </div>
      )}

      {autoProtocol && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>&#128197; Недельный протокол</h3>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Оценка соблюдения: {autoProtocol.overallAdherenceScore}%</div>
          {autoProtocol.warnings.length > 0 && (
            <div style={{ background: 'var(--warning-dim)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              {autoProtocol.warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: 'var(--warning)' }}>{w}</div>)}
            </div>
          )}
          {autoProtocol.days.map((day, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10, marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{day.date}</div>
              {day.slots.map((slot, j) => (
                <div key={j} style={{ marginLeft: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{slot.time === 'morning' ? 'Утро' : slot.time === 'day' ? 'День' : slot.time === 'evening' ? 'Вечер' : 'Ночь'}</div>
                  {slot.substances.map((s, k) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                      <span>{s.name}</span>
                      <span style={{ color: 'var(--accent)' }}>{s.dose}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => setAutoProtocol(null)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', marginTop: 8 }}>Закрыть протокол</button>
        </div>
      )}

      {course.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#128138;</div>
          <div style={{ fontSize: 14, color: 'var(--text-dim)' }}>Добавьте препараты для формирования курса. Здесь будут отображаться все препараты текущего курса, их взаимодействия и рекомендованная ПКТ.</div>
        </div>
      )}
    </div>
  );
};
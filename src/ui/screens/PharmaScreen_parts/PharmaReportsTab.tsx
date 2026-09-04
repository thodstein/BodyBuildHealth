import React, { useMemo, useState } from 'react';
import { PHARMA_DB } from '../../../core/pharma-database';
import { validateCourse } from '../../../engines/pharmacology.engine';
import { checkDrugInteractions } from '../../../engines/interactions-calculator';
import { useDataLink } from '../../../core/data-link';
import { PharmaScoreCard } from '../../components/PharmaScoreCard';

const CURRENT_KEY = 'he_pharma_report_current';
const ARCHIVE_KEY = 'he_pharma_reports';

const CLASS_LABELS: Record<string, string> = {
  testosterone: 'Тестостерон', trenbolone: 'Тренболон', nandrolone: 'Нандролон',
  boldenone: 'Болденон', primobolan: 'Примоболан', oral_17aa: 'Оральные 17-α',
  sarm: 'SARM', peptide_ghrh: 'GHRH', peptide_ghrp: 'GHRP',
  igf1: 'IGF-1', mgf: 'МГФ', insulin: 'Инсулин',
  drostanolone: 'Дростанолон', dht_inject: 'DHT-инъекции',
  peptide_gnrh: 'GnRH', peptide_fat_loss: 'Жиросжигающие', peptide_other: 'Прочие', support: 'Поддержка',
};

interface PharmaReport {
  id: string;
  date: string;
  generatedAt: string;
  substances: { name: string; class: string; dose: string; weeks: string }[];
  totalSubstances: number;
  totalWeeks: number;
  warnings: string[];
  interactions: { type: string; drugs: string[]; mechanism: string; recommendation: string }[];
  riskOverall: number | null;
  timestamp: number;
}

function readCurrent(): PharmaReport | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as PharmaReport) : null;
  } catch {
    return null;
  }
}

export const PharmaReportsTab: React.FC = () => {
  const linked = useDataLink();
  const course = useMemo(() => linked.course || [], [linked.course]);
  const [generated, setGenerated] = useState<PharmaReport | null>(() => readCurrent());

  const validation = useMemo(() => validateCourse(course), [course]);
  const interactions = useMemo(() => checkDrugInteractions(course), [course]);
  const profile = linked.profile?.settings as any;
  const riskOverall = linked.risk?.overallNet ?? null;

  const totalWeeks = useMemo(
    () => Math.max(1, course.reduce((mx, c) => Math.max(mx, (c.endWeek || 12) - (c.startWeek || 0)), 4)),
    [course],
  );

  const generate = () => {
    const report: PharmaReport = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      substances: course.map((c) => ({
        name: PHARMA_DB[c.substanceId]?.name || c.substanceId,
        class: CLASS_LABELS[PHARMA_DB[c.substanceId]?.class || ''] || PHARMA_DB[c.substanceId]?.class || '—',
        dose: `${c.doseValue ?? 0}${c.doseUnit ?? 'мг'}`,
        weeks: `${c.startWeek || 0}–${c.endWeek || totalWeeks}`,
      })),
      totalSubstances: course.length,
      totalWeeks,
      warnings: validation.warnings,
      interactions: interactions.map((i) => ({
        type: i.type,
        drugs: i.drugs,
        mechanism: i.mechanism,
        recommendation: i.recommendation,
      })),
      riskOverall,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(report));
      const archRaw = localStorage.getItem(ARCHIVE_KEY);
      const arch = archRaw ? JSON.parse(archRaw) : [];
      const next = Array.isArray(arch) ? [report, ...arch].slice(0, 20) : [report];
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
    } catch {}
    setGenerated(report);
  };

  const clear = () => {
    try {
      localStorage.removeItem(CURRENT_KEY);
      localStorage.removeItem(ARCHIVE_KEY);
    } catch {}
    setGenerated(null);
  };

  const scoreCourse = useMemo(
    () =>
      course.map((c: any) => ({
        substanceId: c.substanceId || '',
        dose: c.doseValue || 0,
        unit: c.doseUnit || 'мг',
        weeks: (c.endWeek || 12) - (c.startWeek || 0),
      })),
    [course],
  );

  const card: React.CSSProperties = { background:'rgba(22,22,26,0.62)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderRadius:14, padding:14, boxShadow:'0 6px 18px rgba(0,0,0,0.18)' };

  return (
    <div className="pharma-reports" style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(139,92,246,0.06))', border:'1px solid rgba(245,158,11,0.14)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.14)', border:'1px solid rgba(245,158,11,0.18)', fontSize:12 }}>📊</span>
          <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Фарма-отчёт</span>
          <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', background:'rgba(0,0,0,0.18)', padding:'3px 8px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>{course.length} преп. · {totalWeeks} нед</span>
        </div>
        <div style={{ fontSize:11, color:'#fff', marginTop:6, lineHeight:1.45 }}>
          Состав курса, валидация, взаимодействия и PK/PD риск — сформируй отчёт и сохрани в «Профиль → Отчёты».
        </div>
        <div style={{ fontSize:10, color:'#fff', marginTop:6, background:'rgba(0,0,0,0.14)', padding:'6px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>Оценка курса: состав · дозировки · валидация · взаимодействия · риск</div>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button
          onClick={generate}
          style={{
            flex:1, padding:'11px 14px', borderRadius:12, cursor:'pointer', fontWeight:800, fontSize:13,
            background:'linear-gradient(135deg, #f59e0b, #e07b00)', color:'#fff', border:'1px solid rgba(245,158,11,0.32)', boxShadow:'0 6px 16px rgba(245,158,11,0.22)',
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
          }}
        >
          📄 Сгенерировать отчёт
        </button>
        {generated && (
          <button
            onClick={clear}
            style={{
              padding:'11px 12px', borderRadius:12, cursor:'pointer', fontWeight:700, fontSize:11,
              background:'rgba(239,68,68,0.08)', color:'#f87171', border:'1px solid rgba(239,68,68,0.16)',
            }}
          >
            🗑 Очистить
          </button>
        )}
      </div>

      {course.length === 0 ? (
        <div style={{ ...card, textAlign:'center', padding:24, borderStyle:'dashed', background:'rgba(22,22,26,0.32)' }}>
          <div style={{ width:42, height:42, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.14)', fontSize:20 }}>💊</div>
          <div style={{ fontSize:13, color:'#fff', fontWeight:700 }}>Курс пуст</div>
          <div style={{ fontSize:11, color:'#fff', marginTop:4, lineHeight:1.4 }}>Добавь препараты в «Курс», чтобы собрать отчёт — он подтянет дозировки и недели автоматически.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={card}>
            <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', marginBottom:8, display:'flex', alignItems:'center', gap:7 }}>
              💊 Состав курса <span style={{ marginLeft:'auto', fontSize:10, color:'#fff', background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20 }}>{course.length} преп. · {totalWeeks} нед</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {course.map((c, i) => (
                <div key={c.id || i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, padding:'8px 10px', background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:10 }}>
                  <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(245,158,11,0.10)', border:'1px solid rgba(245,158,11,0.14)', fontSize:10, flexShrink:0 }}>💊</span>
                  <span style={{ color:'#fff', fontWeight:700, flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{PHARMA_DB[c.substanceId]?.name || c.substanceId}</span>
                  <span style={{ color:'#fff', fontSize:10, background:'rgba(255,255,255,0.06)', padding:'2px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)', whiteSpace:'nowrap' }}>
                    {c.doseValue}{c.doseUnit} · {c.startWeek || 0}–{c.endWeek}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {validation.warnings.length > 0 && (
            <div style={{ ...card, background:'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))', borderColor:'rgba(245,158,11,0.16)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>⚠️ Валидация <span style={{ marginLeft:'auto', background:'rgba(245,158,11,0.14)', padding:'2px 7px', borderRadius:20, fontSize:10 }}>{validation.warnings.length}</span></div>
              {validation.warnings.map((w, i) => (
                <div key={i} style={{ fontSize:11, color:'#fff', padding:'5px 0 5px 14px', position:'relative', lineHeight:1.4, borderBottom: i<validation.warnings.length-1 ? '1px solid rgba(245,158,11,0.08)' : 'none' }}><span style={{ position:'absolute', left:0, color:'#f59e0b' }}>•</span>{w}</div>
              ))}
            </div>
          )}

          {interactions.length > 0 && (
            <div style={{ ...card, background:'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))', borderColor:'rgba(239,68,68,0.16)' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#f87171', marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>⚡ Взаимодействия <span style={{ marginLeft:'auto', background:'rgba(239,68,68,0.12)', padding:'2px 7px', borderRadius:20, fontSize:10 }}>{interactions.length}</span></div>
              {interactions.slice(0, 8).map((al, i) => (
                <div key={i} style={{ fontSize:11, color:'#fff', padding:'6px 8px', background:'rgba(0,0,0,0.14)', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)', marginBottom:6 }}>
                  <span style={{ fontWeight:800, color: al.type==='critical' ? '#f87171' : '#fbbf24' }}>[{al.type.toUpperCase()}]</span> <span style={{ fontWeight:700 }}>{al.drugs.join(' + ')}</span>
                  <div style={{ fontSize:10, color:'#fff', marginTop:2, lineHeight:1.4 }}>{al.recommendation}</div>
                </div>
              ))}
            </div>
          )}

          <PharmaScoreCard
            course={scoreCourse}
            weight={profile?.personal?.weight || 80}
            age={profile?.personal?.age || 30}
            sex={profile?.personal?.sex || 'male'}
          />

          {generated && (
            <div style={{ ...card, background:'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(0,230,138,0.03))', borderColor:'rgba(0,230,138,0.18)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ width:22, height:22, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,230,138,0.14)', border:'1px solid rgba(0,230,138,0.18)', fontSize:11 }}>✅</span>
                  <span style={{ fontSize:12, fontWeight:800, color:'#00e68a' }}>Отчёт сгенерирован</span>
                </div>
                <span style={{ fontSize:10, color:'#fff', background:'rgba(0,0,0,0.18)', padding:'3px 7px', borderRadius:20, border:'1px solid rgba(255,255,255,0.06)' }}>
                  {generated.generatedAt ? new Date(generated.generatedAt).toLocaleString() : generated.date}
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, fontSize:11 }}>
                <div style={{ background:'rgba(0,0,0,0.18)', padding:'8px', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff', fontWeight:700 }}>Препаратов</div><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{generated.totalSubstances}</div>
                </div>
                <div style={{ background:'rgba(0,0,0,0.18)', padding:'8px', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff', fontWeight:700 }}>Длительность</div><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{generated.totalWeeks} нед</div>
                </div>
                <div style={{ background:'rgba(0,0,0,0.18)', padding:'8px', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff', fontWeight:700 }}>Риск</div><div style={{ fontSize:14, fontWeight:900, color: (generated.riskOverall??0) >=60 ? '#f87171' : (generated.riskOverall??0)>=30 ? '#fbbf24' : '#00e68a' }}>{generated.riskOverall!=null ? `${Math.round(generated.riskOverall)}%` : '—'}</div>
                </div>
                <div style={{ background:'rgba(0,0,0,0.18)', padding:'8px', borderRadius:10, border:'1px solid rgba(255,255,255,0.05)', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#fff', fontWeight:700 }}>Алертов</div><div style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{generated.warnings.length + generated.interactions.length}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'#fff', marginTop:8, textAlign:'center' }}>
                Сохранён в архив — смотри «Профиль → Отчёты → Архив»
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

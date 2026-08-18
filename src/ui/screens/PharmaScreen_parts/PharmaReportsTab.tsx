/**
 * PharmaReportsTab — «💊 Фарма-отчёт» в PharmaScreen.
 * Страница отчёта по курсу с кнопкой генерации: состав, дозировки, валидация,
 * взаимодействия, риск. Сгенерированный отчёт пишется в
 * he_pharma_report_current + архив he_pharma_reports (читается в Профиле → Отчёты).
 */
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

  return (
    <div style={{ padding: '0 12px 80px' }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>💊 Фарма-отчёт</h3>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: '0 0 12px' }}>
        Оценка курса: состав, дозировки, валидация, взаимодействия, риск
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={generate}
          style={{
            padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: 'var(--accent)', color: '#000', border: 'none', flex: 1, minHeight: 38,
          }}
        >
          📄 Сгенерировать отчёт
        </button>
        {generated && (
          <button
            onClick={clear}
            style={{
              padding: '8px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 11,
              background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', minHeight: 38,
            }}
          >
            🗑 Очистить
          </button>
        )}
      </div>

      {course.length === 0 ? (
        <div style={{ borderRadius: 12, padding: 16, background: 'rgba(24,24,27,0.15)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            Курс пуст. Добавьте препараты в «Курс», чтобы сформировать отчёт.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ borderRadius: 12, padding: 12, background: 'rgba(24,24,27,0.15)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
              💊 Состав курса ({course.length} препаратов · {totalWeeks} нед)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {course.map((c, i) => (
                <div key={c.id || i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <span style={{ color: '#fff' }}>{PHARMA_DB[c.substanceId]?.name || c.substanceId}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {c.doseValue}{c.doseUnit} · нед {c.startWeek || 0}–{c.endWeek}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {validation.warnings.length > 0 && (
            <div style={{ borderRadius: 12, padding: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>⚠️ Валидация</div>
              {validation.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', padding: '3px 0' }}>• {w}</div>
              ))}
            </div>
          )}

          {interactions.length > 0 && (
            <div style={{ borderRadius: 12, padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>⚡ Взаимодействия ({interactions.length})</div>
              {interactions.slice(0, 8).map((al, i) => (
                <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', padding: '3px 0' }}>
                  • [{al.type.toUpperCase()}] {al.drugs.join(' + ')} — {al.recommendation}
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
            <div style={{ borderRadius: 12, padding: 14, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00e68a' }}>✅ Отчёт сгенерирован</div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                  {generated.generatedAt ? new Date(generated.generatedAt).toLocaleString() : generated.date}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                Препаратов: {generated.totalSubstances} · Длительность: {generated.totalWeeks} нед
                {generated.riskOverall != null && <> · Общий риск: {Math.round(generated.riskOverall)}%</>}
                <br />
                Валидация: {generated.warnings.length === 0 ? 'замечаний нет' : `${generated.warnings.length} замечаний`}
                {' '}· Взаимодействия: {generated.interactions.length === 0 ? 'не выявлено' : `${generated.interactions.length} алертов`}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                Сохранён в архив и доступен в «Профиль → Отчёты → Архив».
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
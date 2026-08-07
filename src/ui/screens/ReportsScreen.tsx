import React, { useState, useEffect, useCallback } from 'react';
import { generateComprehensiveReport } from '../../engines/comprehensive-report.engine';
import { generateComprehensiveReportHTML } from '../../engines/comprehensive-report-html';
import { ReportSparkline } from '../../ui/components/ReportSparkline';
import { MetricCard } from '../../ui/components/MetricCard';
import type { ComprehensiveReport, ProgressPhoto } from '../../engines/comprehensive-report.engine';
import { colors, glassCard, inputStyle } from '../screens/ProfileScreen_v2/ui';

const STORAGE_KEY = 'he_comprehensive_report_notes';
const PHOTOS_KEY = 'he_progress_photos';

export const ReportsScreen: React.FC = () => {
  const [type, setType] = useState<'weekly' | 'monthly'>('weekly');
  const [report, setReport] = useState<ComprehensiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [userNotes, setUserNotes] = useState('');
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTimeout(async () => {
      const r = await generateComprehensiveReport({ type });
      setReport(r);
      setUserNotes(r.userNotes || '');
      setPhotos(r.photos || []);
      setLoading(false);
    }, 0);
  }, [type]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUserNotes(saved);
      const photosRaw = localStorage.getItem(PHOTOS_KEY);
      if (photosRaw) setPhotos(JSON.parse(photosRaw));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, userNotes); } catch {}
  }, [userNotes]);

  const handlePrint = useCallback(() => {
    if (!report) return;
    const html = generateComprehensiveReportHTML({ ...report, userNotes });
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open(); doc.write(`<html><head><title>Health Report</title></head><body>${html}</body></html>`); doc.close();
      setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => iframe.remove(), 1000); }, 250);
    }
  }, [report]);

  const handleCopyTSV = useCallback(() => {
    if (!report) return;
    const rows: string[] = ['Секция\tМетрика\tЕд.\tНачало\tТекущее\tΔ\tΔ%\tСтатус'];
    report.sections.forEach(s => {
      s.metrics.forEach(m => {
        rows.push([
          s.title, m.label, m.unit,
          formatVal(m.prev), formatVal(m.current),
          m.delta !== undefined && m.delta !== null ? `${m.delta > 0 ? '+' : ''}${formatVal(m.delta)}` : '',
          m.deltaPct !== undefined && m.deltaPct !== null ? `${m.deltaPct > 0 ? '+' : ''}${m.deltaPct.toFixed(1)}%` : '',
          m.status || ''
        ].join('\t'));
      });
    });
    const tsv = rows.join('\n');
    navigator.clipboard.writeText(tsv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [report]);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).slice(0, 4).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: ProgressPhoto = {
          date: new Date().toISOString().slice(0, 10),
          dataUrl: reader.result as string,
          angle: 'other',
        };
        const updated = [...photos, newPhoto].slice(-4);
        setPhotos(updated);
        try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(updated)); } catch {}
      };
      reader.readAsDataURL(file);
    });
  }, [photos]);

  if (loading || !report) {
    return <div style={{ padding: 20, textAlign: 'center', color: colors.textMuted }}>Формирование отчёта...</div>;
  }

  const periodLabel = type === 'weekly' ? 'Неделя 7д' : 'Месяц 30д';

  return (
    <div style={{ padding: '0 0 80px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 0', flexShrink: 0, position: 'sticky', top: 0, zIndex: 20, background: '#18181b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>📊 Комплексный отчёт</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setType('weekly')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: type === 'weekly' ? colors.primary : 'rgba(255,255,255,0.08)', color: type === 'weekly' ? '#000' : '#fff', border: 'none', cursor: 'pointer' }}>Неделя 7д</button>
          <button onClick={() => setType('monthly')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: type === 'monthly' ? colors.primary : 'rgba(255,255,255,0.08)', color: type === 'monthly' ? '#000' : '#fff', border: 'none', cursor: 'pointer' }}>Месяц 30д</button>
          <button onClick={handleCopyTSV} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: copied ? colors.green : 'rgba(255,255,255,0.08)', color: '#000', border: 'none', cursor: 'pointer' }}>{copied ? '✓ Скопировано' : '📋 Excel'}</button>
          <button onClick={handlePrint} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: colors.blue, color: '#fff', border: 'none', cursor: 'pointer' }}>🖨 PDF</button>
        </div>
      </div>

      <div style={{ padding: '12px 0' }}>
        {/* Meta */}
        <div style={{ ...glassCard, marginBottom: 12, fontSize: 11, color: colors.textMuted }}>
          <b style={{ color: colors.text }}>{report.meta.userName}</b> | {report.meta.age || '—'} лет | {report.meta.sex === 'male' ? '♂' : report.meta.sex === 'female' ? '♀' : '—'} |
          <b> {periodLabel}</b> | {report.meta.dateFrom} — {report.meta.dateTo}
          {report.meta.courseWeek && <span> | Курс: нед. {report.meta.courseWeek} из {report.meta.coursePhase || 'course'}</span>}
        </div>

        {/* Фото прогресса */}
        <div style={{ ...glassCard, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: colors.text }}>📸 Фото прогресса</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ width: '45%', minWidth: 140 }}>
                <img src={p.dataUrl} style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} />
                <div style={{ fontSize: 9, color: colors.textMuted, marginTop: 2 }}>{p.date} {p.label || ''}</div>
              </div>
            ))}
            {photos.length === 0 && <div style={{ fontSize: 11, color: colors.textMuted }}>Нет фото. Загрузите до 4 фото.</div>}
          </div>
          <label style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)', color: colors.text, fontSize: 11, cursor: 'pointer' }}>
            📷 Загрузить фото
            <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Секции */}
        {report.sections.map(section => (
          <div key={section.id} style={{ ...glassCard, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: colors.text }}>{section.icon} {section.title}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {section.metrics.map((m, i) => (
                <MetricCard key={i} {...m} compact />
              ))}
            </div>
          </div>
        ))}

        {/* Курс ААС + Поддержка */}
        <div style={{ ...glassCard, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: colors.text }}>💉 Курс ААС + Поддержка</div>
          {report.support.course.isActive && (
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
              Старт: {report.support.course.startDate} | Неделя {report.support.course.weekCurrent} из {report.support.course.weekTotal} | Фаза: {report.support.course.phase}
            </div>
          )}
          {report.support.course.substances.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>Вещество</th>
                  <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>Класс</th>
                  <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>Доза</th>
                  <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>Путь</th>
                  <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>Кратность</th>
                  <th style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>Недели</th>
                </tr></thead>
                <tbody>
                  {report.support.course.substances.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)' }}>{s.name}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>{s.className || '—'}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>{s.doseDisplay}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>{s.route === 'inject' ? 'Инъекция' : 'Орально'}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>{s.frequency}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>{s.startWeek}-{s.endWeek}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Мониторинг */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: colors.text }}>🔬 Мониторинг анализов</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {report.support.monitoring.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                  <span style={{ color: colors.text }}>{m.marker}</span>
                  <span style={{ color: colors.textMuted }}>{m.when}</span>
                  <span style={{ color: colors.textMuted }}>{m.targetRange || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Нагрузка */}
          <div style={{ marginTop: 10, fontSize: 11, color: colors.textMuted }}>
            <b>Нагрузка:</b> {report.support.pillBurden.totalSubstances} веществ, ~{report.support.pillBurden.pillsPerDay} таб/день |
            {report.support.depletionWarnings.length > 0 && <span style={{ color: colors.warning }}> Дефициты: {report.support.depletionWarnings.map(d => `${d.depleter} → ${d.depleted}`).join(', ')}</span>}
          </div>
        </div>

        {/* Рекомендации */}
        {report.recommendations.length > 0 && (
          <div style={{ ...glassCard, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: colors.text }}>📋 Рекомендации для врача</div>
            {report.recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 11, padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: `${r.priority === 'critical' ? colors.danger : r.priority === 'warning' ? colors.warning : colors.blue}11`, borderLeft: `3px solid ${r.priority === 'critical' ? colors.danger : r.priority === 'warning' ? colors.warning : colors.blue}` }}>
                <b>[{r.priority.toUpperCase()}]</b> {r.text}
              </div>
            ))}
          </div>
        )}

        {/* Поле заметок */}
        <div style={{ ...glassCard, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: colors.text }}>📝 Дополнительные сведения</div>
          <textarea
            value={userNotes}
            onChange={e => setUserNotes(e.target.value)}
            placeholder="Запишите всё, что считаете важным для врача: стрессовые факторы, изменения сна, диеты, побочные эффекты, вопросы..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          />
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 10, color: colors.textMuted, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          Сформировано автоматически | {new Date().toLocaleString('ru-RU')} | Health Engine TZ v2 | Для передачи курирующему врачу
        </div>
      </div>
    </div>
  );
};

function formatVal(v: number | string | null | undefined): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number') return v % 1 === 0 ? String(v) : v.toFixed(1);
  return String(v);
}

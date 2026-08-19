// RiskVerificationList.tsx — перечень анализов для верификации рисков (ТЗ).
// Общий компонент: подвкладка «Анализы» в RiskSpecMethod и «Верификация рисков» в LabsScreen.
// Экспорт: 📋 текст в буфер · 📊 CSV · 🖨 PDF (печать) — по образцу ПЛ-авто.
import React, { useMemo, useState } from 'react';
import type { TzSpecResult } from '../../../engines/risk-engine-tz-spec';
import {
  buildVerificationReport,
  buildVerificationText,
  buildVerificationCsv,
  buildVerificationHtml,
  statusColor,
  statusLabel,
  thresholdText,
} from '../../../engines/risk-verification.engine';
import { TZ_MECH_LABELS } from '../../../data/support-db';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 16, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 };

const EXPORT_BTN: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700,
  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa',
  whiteSpace: 'nowrap',
};

export const RiskVerificationList: React.FC<{ labMap: Record<string, number>; result?: TzSpecResult | null }> = ({ labMap, result }) => {
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => buildVerificationReport(labMap || {}), [labMap]);

  // Верификация из движка ТЗ (risk-engine-tz-spec) — те же числа, что в карточках
  // «Индекс риска · верифицировано анализами», чтобы вкладка и карточка совпадали.
  // Fallback на собственный расчёт — когда результата нет (вкладка работает и без курса).
  const engineOverall = useMemo(() => {
    if (!result || typeof result.overallVerification !== 'number') return null;
    return result.overallVerification;
  }, [result]);
  const verifById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of result?.organs || []) {
      if (typeof o.verification === 'number') m[o.id] = o.verification;
    }
    return m;
  }, [result]);
  const sysVerif = (sysId: string) => verifById[sysId] ?? report.systems.find(s => s.id === sysId)?.verification ?? 0;
  const verifiedSystems = report.systems.filter(s => sysVerif(s.id) >= 0.5).length;

  const organById = useMemo(() => {
    const m: Record<string, { raw: number; after: number }> = {};
    for (const o of result?.organs || []) m[o.id] = { raw: o.rawPercent, after: o.afterPercent };
    return m;
  }, [result]);

  const copyText = async () => {
    const text = buildVerificationText(labMap || {});
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      document.body.removeChild(ta);
    }
  };

  const downloadCsv = () => {
    const csv = buildVerificationCsv(labMap || {});
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-risks-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const printPdf = () => {
    try {
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(buildVerificationHtml(labMap || {}));
      w.document.close();
      w.focus();
      w.print();
    } catch {}
  };

  const overallPct = Math.round((engineOverall ?? report.overall) * 100);

  return (
    <div style={{ padding: '4px 0 80px' }}>
      {/* HERO */}
      <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(0,230,138,0.05) 0%, rgba(24,24,27,0.15) 100%)', border: '1px solid rgba(0,230,138,0.12)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🔬 Верификация рисков анализами</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4, marginBottom: 8 }}>
          Перечень анализов по 6 системам и 28 механизмам · пороги m_i = 1/2/3 (таблица T4) · якорные floors по лабораторным порогам
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 130 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Верифицировано систем</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: overallPct >= 50 ? '#4ade80' : '#fbbf24' }}>{overallPct}%</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{verifiedSystems}/{report.systems.length}</span>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            Маркеров в профиле: <b style={{ color: '#fff' }}>{report.presentMarkers}/{report.totalMarkers}</b>
            <br />Якорных попаданий (floors): <b style={{ color: report.floorsCount > 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)' }}>{report.floorsCount}</b>
            {report.floorsCount > 0 && ' — риск систем поднят независимо от препаратов'}
          </div>
        </div>
        {overallPct < 50 && (
          <div style={{ marginTop: 8, fontSize: 9, color: '#fbbf24', lineHeight: 1.4 }}>
            ⚠ Менее половины систем верифицировано — оценка по фармакологии. Сдайте анализы: липидограмма, ОАК (гематокрит), печёночный и почечный блок, ТТГ, глюкоза, ЛГ/ФСГ/тестостерон.
          </div>
        )}
      </div>

      {/* EXPORT */}
      <div style={{ ...CARD, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>📤 Экспорт:</span>
        <button onClick={copyText} style={EXPORT_BTN}>{copied ? '✅ Скопировано' : '📋 Текст'}</button>
        <button onClick={downloadCsv} style={EXPORT_BTN}>📊 CSV</button>
        <button onClick={printPdf} style={EXPORT_BTN}>🖨 PDF</button>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>весь перечень по всем системам</span>
      </div>

      {/* SYSTEMS */}
      {report.systems.map(sys => {
        const organ = organById[sys.id];
        const verif = sysVerif(sys.id);
        return (
          <div key={sys.id} style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {sys.icon} {sys.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {organ && (
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: statusColor(organ.after >= 50 ? 3 : organ.after >= 25 ? 2 : 0) }}>
                    риск {organ.raw}% → {organ.after}%
                  </span>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, color: verif >= 0.5 ? '#4ade80' : '#fbbf24' }}>
                  {Math.round(verif * 100)}% · {sys.presentCount}/{sys.total}
                </span>
              </div>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(verif * 100)}%`, background: verif >= 0.5 ? '#4ade80' : '#fbbf24', borderRadius: 3 }} />
            </div>

            {sys.floorHits.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {sys.floorHits.map((f, i) => (
                  <div key={i} style={{ fontSize: 9, color: '#fca5a5', lineHeight: 1.5, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 6, padding: '3px 8px', marginBottom: 3 }}>
                    ⚓ {f.label} — риск ≥ {f.risk}%
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gap: 4 }}>
              {sys.mechanisms.map(mech => (
                <div key={mech.id} style={{ padding: '5px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: sys.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{TZ_MECH_LABELS[mech.id] || mech.id}</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>w={mech.weight}</span>
                    {mech.present && mech.markers.length > 0 ? (
                      <span style={{ fontSize: 8, color: '#4ade80', marginLeft: 'auto' }}>✅ есть маркер</span>
                    ) : mech.markers.length > 0 ? (
                      <span style={{ fontSize: 8, color: '#fbbf24', marginLeft: 'auto' }}>⚠ нет данных</span>
                    ) : null}
                  </div>
                  {mech.note && (
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>— {mech.note}</div>
                  )}
                  {mech.markers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {mech.markers.map((mk, i) => (
                        <div key={i} title={`${mk.name}: пороги ${thresholdText(mk)} ${mk.unit}`} style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, fontSize: 9,
                          background: mk.present ? `${statusColor(mk.status)}14` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${mk.present ? `${statusColor(mk.status)}30` : 'rgba(255,255,255,0.06)'}`,
                          color: mk.present ? statusColor(mk.status) : 'rgba(255,255,255,0.35)',
                        }}>
                          <span style={{ fontWeight: 600, color: mk.present ? '#fff' : 'rgba(255,255,255,0.35)' }}>{mk.name}</span>
                          {mk.present ? (
                            <>
                              <span>{mk.value}</span>
                              <span style={{ opacity: 0.6 }}>{mk.unit}</span>
                              <span style={{ opacity: 0.5 }}>· {statusLabel(mk.status)}</span>
                            </>
                          ) : (
                            <span style={{ opacity: 0.6 }}>нет данных</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5, padding: '0 4px' }}>
        Пороги m_i (таблица T4 механизм-ориентированной модели): 1 — пограничный, 2 — выраженный, 3 — критический.
        Якорные floors (⚓) поднимают риск системы независимо от препаратов и покрытия анализами.
      </div>
    </div>
  );
};

export default RiskVerificationList;
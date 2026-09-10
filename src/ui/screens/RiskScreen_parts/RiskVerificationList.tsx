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
import { copyOrShareText, saveCsvApk, printHtmlApk, shareOutcomeLabel } from '../../../core/apk-share';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { padding: 16, borderRadius: 18, background: 'rgba(20,22,30,0.55)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 12px 30px rgba(0,0,0,0.20)', marginBottom: 12 };

const EXPORT_BTN: React.CSSProperties = {
  minHeight: 44, padding: '10px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 800,
  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.30)', color: '#fff',
  whiteSpace: 'nowrap',
};

export const RiskVerificationList: React.FC<{ labMap: Record<string, number>; result?: TzSpecResult | null }> = ({ labMap, result }) => {
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const flashShare = (msg: string) => {
    setShareStatus(msg);
    try { setTimeout(() => setShareStatus(null), 2500); } catch {}
  };

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
    const o = await copyOrShareText(text, 'Верификация рисков');
    if (o === 'failed') return;
    setCopied(true);
    flashShare(shareOutcomeLabel(o));
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = async () => {
    const csv = buildVerificationCsv(labMap || {});
    flashShare(shareOutcomeLabel(await saveCsvApk(`verification-risks-${new Date().toISOString().slice(0, 10)}.csv`, csv)));
  };

  const printPdf = async () => {
    const html = buildVerificationHtml(labMap || {});
    const text = buildVerificationText(labMap || {});
    flashShare(shareOutcomeLabel(await printHtmlApk(html, `verification-risks-${new Date().toISOString().slice(0, 10)}.html`, text)));
  };

  const overallPct = Math.round((engineOverall ?? report.overall) * 100);

  return (
    <div className="risk-verify" style={{ padding: '4px 0 80px' }}>
      {/* HERO — APK PRO: белый текст, крупно */}
      <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(0,230,138,0.10) 0%, rgba(20,22,30,0.60) 100%)', border: '1px solid rgba(0,230,138,0.22)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🔬 Верификация рисков анализами</div>
        <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.5, marginBottom: 10 }}>
          Перечень анализов по 6 системам и 28 механизмам · пороги m_i = 1/2/3 (таблица T4) · якорные floors по лабораторным порогам
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 120, flex:1, padding:'12px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', textAlign:'center' }}>
            <div style={{ fontSize: 12, color: '#fff', fontWeight:700, marginBottom: 4 }}>Верифицировано систем</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent:'center' }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: overallPct >= 50 ? '#4ade80' : '#fbbf24' }}>{overallPct}%</span>
              <span style={{ fontSize: 13, color: '#fff', fontWeight:700 }}>{verifiedSystems}/{report.systems.length}</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.55, flex:2, minWidth:160 }}>
            Маркеров в профиле: <b style={{ color: '#fff' }}>{report.presentMarkers}/{report.totalMarkers}</b>
            <br />Якорных попаданий (floors): <b style={{ color: '#fff' }}>{report.floorsCount}</b>
            {report.floorsCount > 0 && ' — риск систем поднят независимо от препаратов'}
          </div>
        </div>
        {overallPct < 50 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#fff', lineHeight: 1.5, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.24)', borderRadius:10, padding:'8px 10px' }}>
            ⚠ Менее половины систем верифицировано — оценка по фармакологии. Сдайте анализы: липидограмма, ОАК (гематокрит), печёночный и почечный блок, ТТГ, глюкоза, ЛГ/ФСГ/тестостерон.
          </div>
        )}
        <div className="risk-verify-nav" style={{ display:'flex', gap:8, overflowX:'auto', marginTop:12, paddingBottom:2, scrollbarWidth:'none' }}>
          {report.systems.map(s => (
            <button key={s.id} onClick={() => { try { document.getElementById(`verify-${s.id}`)?.scrollIntoView({ behavior:'smooth', block:'start' }); } catch {} }} style={{ flexShrink:0, minHeight:44, padding:'8px 14px', borderRadius:999, fontSize:13, fontWeight:800, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff' }}>{s.icon} {s.name}</button>
          ))}
        </div>
      </div>

      {/* EXPORT — липкая удобная лента (ниже сабтабов 56+67: зазор 9px) */}
      <div className="risk-verify-export" style={{ ...CARD, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', position:'sticky', top:132, zIndex:10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>📤 Экспорт:</span>
        <button onClick={() => void copyText()} style={EXPORT_BTN}>{copied ? '✅ Скопировано' : '📋 Текст'}</button>
        <button onClick={() => void downloadCsv()} style={EXPORT_BTN}>📊 CSV</button>
        <button onClick={() => void printPdf()} style={EXPORT_BTN}>🖨 PDF</button>
        <span style={{ fontSize: 11, color: '#fff' }}>весь перечень по всем системам</span>
        {shareStatus && <span role="status" style={{ fontSize: 11, color: '#fff', width:'100%' }}>{shareStatus}</span>}
      </div>

      {/* SYSTEMS */}
      {report.systems.map(sys => {
        const organ = organById[sys.id];
        const verif = sysVerif(sys.id);
        return (
          <div key={sys.id} id={`verify-${sys.id}`} style={{ ...CARD, scrollMarginTop: 170 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap:'wrap', gap:10, marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color:'#fff', flex:'1 1 140px', minWidth:0 }}>
                {sys.icon} {sys.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink:0 }}>
                {organ && (
                  <span style={{ fontSize: 12, fontWeight:800, padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)', color: '#fff' }}>
                    риск {organ.raw}% → {organ.after}%
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                  {Math.round(verif * 100)}% · {sys.presentCount}/{sys.total}
                </span>
              </div>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 999, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(verif * 100)}%`, background: verif >= 0.5 ? '#4ade80' : '#fbbf24', borderRadius: 999 }} />
            </div>

            {sys.floorHits.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {sys.floorHits.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, fontWeight:700, color: '#fff', lineHeight: 1.5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 10, padding: '6px 10px', marginBottom: 4 }}>
                    ⚓ {f.label} — риск ≥ {f.risk}%
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gap: 6 }}>
              {sys.mechanisms.map(mech => (
                <div key={mech.id} style={{ padding: '10px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: sys.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{TZ_MECH_LABELS[mech.id] || mech.id}</span>
                    <span style={{ fontSize: 11, color: '#fff' }}>w={mech.weight}</span>
                    {mech.present && mech.markers.length > 0 ? (
                      <span style={{ fontSize: 11, fontWeight:800, color: '#fff', marginLeft: 'auto' }}>✅ есть маркер</span>
                    ) : mech.markers.length > 0 ? (
                      <span style={{ fontSize: 11, fontWeight:800, color: '#fff', marginLeft: 'auto' }}>⚠ нет данных</span>
                    ) : null}
                  </div>
                  {mech.note && (
                    <div style={{ fontSize: 12, color: '#fff', marginBottom: 4, lineHeight:1.45 }}>— {mech.note}</div>
                  )}
                  {mech.markers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {mech.markers.map((mk, i) => (
                        <div key={i} title={`${mk.name}: пороги ${thresholdText(mk)} ${mk.unit}`} style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight:600,
                          background: mk.present ? `${statusColor(mk.status)}1e` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${mk.present ? `${statusColor(mk.status)}40` : 'rgba(255,255,255,0.08)'}`,
                          color: '#fff',
                        }}>
                          <span style={{ fontWeight: 800, color: '#fff' }}>{mk.name}</span>
                          {mk.present ? (
                            <>
                              <span style={{ color:'#fff' }}>{mk.value}</span>
                              <span style={{ color:'#fff' }}>{mk.unit}</span>
                              <span style={{ color:'#fff' }}>· {statusLabel(mk.status)}</span>
                            </>
                          ) : (
                            <span style={{ color:'#fff' }}>нет данных</span>
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

      <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.55, padding: '0 4px' }}>
        Пороги m_i (таблица T4 механизм-ориентированной модели): 1 — пограничный, 2 — выраженный, 3 — критический.
        Якорные floors (⚓) поднимают риск системы независимо от препаратов и покрытия анализами.
      </div>
    </div>
  );
};

export default RiskVerificationList;
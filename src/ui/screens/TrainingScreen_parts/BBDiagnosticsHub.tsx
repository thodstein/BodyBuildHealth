/**
 * BBDiagnosticsHub.tsx — ББ-диагностика PRO (тонкий хаб, без дублей).
 * 3 уникальных таба (слабые/симметрия/стимул) + 3 композитных (объём→VolumeHub, восстановление→Unified snapshot, мобильность/VBT→reuse WL libs).
 * Хедер RSS 0-100 + verification + ACWR-chip + MRV-chip. Мост weakpoints → BbAutoConstructor.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { CARD, DIM, ACCENT } from './training-ui';
import { applyToPlanner } from './planner-bridge';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { scoreColor as bbScoreColor } from '../../../engines/bb/bb-scoring.engine';
import { buildBBDiagnosticsReport } from '../../../engines/bb/bb-diagnostics-hub.engine';
import { buildBBDiagnosticsHtml, buildBBDiagnosticsCsv, downloadHtml, downloadCsv } from '../../../engines/bb/bb-diagnostics-export.engine';
import { getVolumeLandmarks, MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { aggregateBBVolume } from '../../../engines/bb/bb-volume.engine';
import { analyzeBBBalance } from '../../../engines/bb/bb-balance.engine';
import { computePerMuscleACWR } from '../../../engines/bb/bb-progression-feedback.engine';
import { assessOHS, OHS_NORMS } from '../../../engines/strength-sport/strength-sport-ohs.engine';
import { parseKinoveaCSV, analyzeBarTracking } from '../../../engines/strength-sport/strength-sport-video.engine';
import { bbVbtRecommendation } from '../../../engines/bb/bb-vbt.engine';
import { isSpecializationTargetConflict } from '../../../engines/bb/bb-specialization.engine';

const STORAGE_KEY = 'he_bb_diagnostics_hub_v1';
type BBTab = 'weak' | 'symmetry' | 'stimulus' | 'volume' | 'recovery' | 'mobility';

type BBState = {
  weakManual: string[];
  circ: Record<string, string>;
  ohsHeelsFlat: boolean; ohsKneeValgus: boolean; ohsHipBelowParallel: boolean; ohsTrunkUpright: boolean; ohsArmsOverMidfoot: boolean; ohsLumbarNeutral: boolean;
  kneeToWallCm: string; ankleDeg: string; heelRetest: '' | 'better' | 'same';
  vbtBest: string; vbtLast: string; vbtWeight: string;
  csvText: string;
};

const DEFAULT_STATE: BBState = {
  weakManual: [],
  circ: { heightCm: '175', weightKg: '80', bodyFat: '', neck: '', chest: '', waist: '', hips: '', bicepL: '', bicepR: '', thighL: '', thighR: '', calfL: '', calfR: '', shoulderWidth: '', forearmL: '', forearmR: '' },
  ohsHeelsFlat: true, ohsKneeValgus: false, ohsHipBelowParallel: true, ohsTrunkUpright: true, ohsArmsOverMidfoot: true, ohsLumbarNeutral: true,
  kneeToWallCm: '', ankleDeg: '', heelRetest: '',
  vbtBest: '', vbtLast: '', vbtWeight: '',
  csvText: '',
};

const TAB_DEFS: Array<{ id: BBTab; label: string; icon: string; desc: string }> = [
  { id: 'weak', label: 'Слабые', icon: '🎯', desc: 'гранулярные 1-2 + e1RM + Reeves' },
  { id: 'symmetry', label: 'Симметрия', icon: '⚖️', desc: 'L/R + V-taper + FFMI' },
  { id: 'stimulus', label: 'Стимул', icon: '💪', desc: 'lengthened + pattern + BFR' },
  { id: 'volume', label: 'Объём', icon: '📊', desc: 'MEV/MAV/MRV чип' },
  { id: 'recovery', label: 'Восстановление', icon: '🔋', desc: 'ACWR per-muscle + Unified' },
  { id: 'mobility', label: 'Мобильность/VBT', icon: '🦿', desc: 'OHS6 + VBT 20-25%' },
];

const GRANULAR_OPTS: Array<{ id: string; label: string }> = [
  { id: 'delt_mid', label: 'Средняя дельта' },
  { id: 'delt_rear', label: 'Задняя дельта' },
  { id: 'delt_front', label: 'Передняя дельта' },
  { id: 'chest_upper', label: 'Верх груди' },
  { id: 'chest_lower', label: 'Низ груди' },
  { id: 'back_width', label: 'Ширина спины' },
  { id: 'back_thickness', label: 'Толщина спины' },
  { id: 'quads', label: 'Квадрицепс' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'glutes', label: 'Ягодицы' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'calves', label: 'Икры' },
  { id: 'traps', label: 'Трапеции' },
  { id: 'forearms', label: 'Предплечья' },
];

export const BBDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<BBState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw), circ: { ...DEFAULT_STATE.circ, ...(JSON.parse(raw).circ || {}) } };
    } catch {}
    return DEFAULT_STATE;
  });
  const [tab, setTab] = useState<BBTab>('weak');
  const [toast, setToast] = useState<string>('');

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }, [state]);

  const level = useMemo(() => {
    try { const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}'); return p?.settings?.training?.level || p?.training?.level || 'intermediate'; } catch { return 'intermediate'; }
  }, []);

  const diarySessions: any[] = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_workout_log_v1') || localStorage.getItem('he_training_log') || localStorage.getItem('he_workout_log_v2') || '[]';
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, []);

  const factVolume = useMemo(() => {
    try {
      // последние 7 дней факт (effective)
      const now = Date.now();
      const DAY = 24 * 3600 * 1000;
      const recent = diarySessions.filter((s: any) => {
        const t = s.date ? new Date(s.date).getTime() : 0;
        return t && now - t <= 7 * DAY;
      });
      if (recent.length === 0) return null;
      // агрегируем sets per muscle (diary muscleGroup)
      const agg: Record<string, { directSets: number; effectiveSets: number }> = {};
      for (const s of recent) for (const ex of (s.exercises || []) as any[]) {
        const m = String(ex.muscleGroup || ex.muscle || '').toLowerCase();
        if (!m) continue;
        const cnt = Array.isArray(ex.sets) ? ex.sets.length : 0;
        if (!agg[m]) agg[m] = { directSets: 0, effectiveSets: 0 };
        agg[m].directSets += cnt;
        agg[m].effectiveSets += cnt;
      }
      return agg;
    } catch { return null; }
  }, [diarySessions]);

  const perMuscleAcwr = useMemo(() => {
    try { return computePerMuscleACWR(diarySessions as any); } catch { return {}; }
  }, [diarySessions]);

  const acwr = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      if (srpe.length < 2) return null;
      return acuteChronicRatio(toDailyLoads(srpe as any));
    } catch { return null; }
  }, [diarySessions]);

  const balance = useMemo(() => {
    try {
      const raw = localStorage.getItem('he_bb_plan_saved') || localStorage.getItem('he_bb_plans');
      let plan: any = null;
      if (raw) {
        const j = JSON.parse(raw);
        if (Array.isArray(j) && j[0]?.plan?.weeks) plan = j[0].plan;
        else if (j?.plan?.weeks) plan = j.plan;
        else if (j?.weeks) plan = j;
      }
      if (plan?.weeks) return analyzeBBBalance(plan);
      return null;
    } catch { return null; }
  }, [diarySessions]);

  const ohs = useMemo(() => assessOHS({
    heelsFlat: state.ohsHeelsFlat, kneeValgus: state.ohsKneeValgus, hipBelowParallel: state.ohsHipBelowParallel,
    trunkUpright: state.ohsTrunkUpright, armsOverMidfoot: state.ohsArmsOverMidfoot, lumbarNeutral: state.ohsLumbarNeutral,
    kneeToWallCm: state.kneeToWallCm ? parseFloat(state.kneeToWallCm) : null,
    ankleDorsiflexDeg: state.ankleDeg ? parseFloat(state.ankleDeg) : null,
    heelRaiseRetest: state.heelRetest === 'better' ? true : state.heelRetest === 'same' ? false : null,
  }), [state.ohsHeelsFlat, state.ohsKneeValgus, state.ohsHipBelowParallel, state.ohsTrunkUpright, state.ohsArmsOverMidfoot, state.ohsLumbarNeutral, state.kneeToWallCm, state.ankleDeg, state.heelRetest]);

  const vbt = useMemo(() => {
    const best = parseFloat(state.vbtBest), last = parseFloat(state.vbtLast);
    if (!Number.isFinite(best) || !Number.isFinite(last) || !best) return null;
    const w = state.vbtWeight ? parseFloat(state.vbtWeight) : undefined;
    return bbVbtRecommendation('squat', best, last, w);
  }, [state.vbtBest, state.vbtLast, state.vbtWeight]);

  const measNum: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(state.circ)) {
      const n = parseFloat(v as string);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  }, [state.circ]);

  const report = useMemo(() => buildBBDiagnosticsReport({
    level,
    factVolume: factVolume as any,
    sessions: diarySessions as any,
    meas: measNum as any,
    heightCm: measNum.heightCm ?? null,
    plan: (() => { try { const raw = localStorage.getItem('he_bb_plan_saved'); if (raw) { const j = JSON.parse(raw); if (j?.plan?.weeks) return j.plan; if (j?.weeks) return j; } return null; } catch { return null; } })(),
    balance,
    perMuscleAcwr: perMuscleAcwr as any,
    mobilityFails: ohs.failed,
    vbtLossPct: vbt?.lossPct ?? null,
    hasDiary: diarySessions.length > 0,
    hasCircumf: Object.keys(measNum).some(k => ['chest','waist','bicepL','bicepR','thighL','thighR'].includes(k)),
    hasVbt: !!vbt,
    manualWeak: state.weakManual,
  }), [level, factVolume, diarySessions, measNum, balance, perMuscleAcwr, ohs.failed, vbt, state.weakManual]);

  const score = report.score.score;
  const sLevel = report.score.level;
  const sColor = bbScoreColor(sLevel);

  const toggleWeak = (id: string) => {
    setState(s => {
      const has = s.weakManual.includes(id);
      let next: string[];
      if (has) next = s.weakManual.filter(x => x !== id);
      else {
        // проверка конфликта parent+zone
        if (s.weakManual.some(ex => isSpecializationTargetConflict(ex, id))) {
          setToast('Конфликт: плечи+зона нельзя, две зоны можно');
          setTimeout(() => setToast(''), 2000);
          return s;
        }
        next = [...s.weakManual, id].slice(0, 2);
      }
      return { ...s, weakManual: next };
    });
  };

  const applyToConstructor = () => {
    if (report.weakMusclesCanonical.length === 0) {
      setToast('Слабые зоны не выбраны — выберите 1-2 (или заполните дневник/замеры для авто)');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    applyToPlanner({
      kind: 'weakpoints',
      label: `ББ диагностика: ${report.weakMusclesCanonical.join(', ')}`,
      data: {
        groups: report.weakMusclesCanonical,
        weakPoints: report.weakMusclesCanonical,
        weakZonesGranular: report.weakZonesGranular,
        bbDiagScore: score, bbDiagLevel: sLevel, verification: report.score.verification,
        symmetry: report.symmetry, stimulus: report.stimulus, perMuscleAcwr,
        ohs: { totalScore: ohs.totalScore, failed: ohs.failed },
        vbt: vbt ? { lossPct: vbt.lossPct, zone: vbt.zone } : null,
      } as any,
      source: 'intellectual',
    });
    setToast(`✓ Применено в ББ-авто: ${report.weakZonesGranular.join(', ')} (score ${score})`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'bb' } as any));
      localStorage.setItem('he_training_planning_track', 'bb');
    } catch {}
  };

  const applyMobilityToProfile = () => {
    const restrictions: string[] = [];
    if (!state.ohsHeelsFlat) restrictions.push('ankle');
    if (state.ohsKneeValgus) restrictions.push('hip');
    if (!state.ohsHipBelowParallel) restrictions.push('hip');
    if (!state.ohsTrunkUpright) restrictions.push('hip');
    if (!state.ohsArmsOverMidfoot) restrictions.push('shoulder');
    if (!state.ohsLumbarNeutral) restrictions.push('lower_back');
    if (state.kneeToWallCm && Number.isFinite(parseFloat(state.kneeToWallCm)) && parseFloat(state.kneeToWallCm) < 12) restrictions.push('ankle');
    const uniq = [...new Set(restrictions)];
    try {
      const raw = localStorage.getItem('he_profile_v2');
      const p = raw ? JSON.parse(raw) : {};
      p.health = p.health || {}; p.health.mobilityRestrictions = uniq;
      p.training = p.training || {}; (p.training as any).mobilityRestrictions = uniq;
      localStorage.setItem('he_profile_v2', JSON.stringify(p));
      try { window.dispatchEvent(new CustomEvent('profile-updated')); } catch {}
      setToast(`✓ Мобильность ${uniq.join(', ') || 'OK'} → профиль`);
      setTimeout(() => setToast(''), 2500);
    } catch {}
  };

  const handleCsvParse = () => {
    const pts = parseKinoveaCSV(state.csvText);
    if (!pts) { setToast('CSV не распознан'); setTimeout(() => setToast(''), 2000); return; }
    const res = analyzeBarTracking(pts as any);
    if (!res) { setToast('Нет точек'); return; }
    setToast(`✓ Kinovea: xLoop ${res.xLoop}см yMax ${res.yMax}см vmax ${res.vmax} м/с`);
    setTimeout(() => setToast(''), 3000);
  };

  const handleExport = () => {
    const html = buildBBDiagnosticsHtml(report, { date: new Date().toISOString().slice(0, 10), level });
    downloadHtml(html, `bb-diagnostics-${new Date().toISOString().slice(0, 10)}.html`);
    setToast('✓ HTML экспорт');
    setTimeout(() => setToast(''), 2000);
  };
  const handleExportCsv = () => {
    const csv = buildBBDiagnosticsCsv(report);
    downloadCsv(csv, `bb-diagnostics-${new Date().toISOString().slice(0, 10)}.csv`);
    setToast('✓ CSV экспорт');
    setTimeout(() => setToast(''), 2000);
  };

  const unifiedSnap = useMemo(() => {
    try { const raw = localStorage.getItem('he_unified_intel_snapshot_v1'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }, [diarySessions]);

  return (
    <div style={{ padding: '10px 8px 18px', color: '#fff', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ ...CARD, padding: '14px 14px 12px', background: 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(0,230,138,0.22)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -18, right: -18, width: 110, height: 110, borderRadius: 110, background: 'radial-gradient(circle,rgba(0,230,138,0.14),transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#00e68a,#a855f7)', color: '#fff', fontWeight: 900, fontSize: 16 }}>💪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>ББ-диагностика — хаб PRO</div>
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, opacity: 0.9 }}>Отстающие × e1RM/Rееves + симметрия L/R + стимул lengthened + объём MEV/MAV/MRV + ACWR per-muscle + OHS6 + VBT 20-25%.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: `conic-gradient(${sColor} ${score}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${sColor}`, fontWeight: 900, color: '#fff', fontSize: 14 }}>{score}</div>
            <div style={{ fontSize: 9, color: sColor, fontWeight: 700, marginTop: 2 }}>{sLevel === 'ok' ? 'ОК' : sLevel === 'warn' ? 'WARN' : 'CRITICAL'} · v{report.score.verification}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, marginBottom: 8 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>ACWR {acwr ? acwr.ratio.toFixed(2) : '—'} {acwr ? (acwr.zone === 'dangerous' ? '🔴' : acwr.zone === 'caution' ? '🟠' : '🟢') : ''}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>{report.weakMusclesCanonical.length ? `${report.weakMusclesCanonical.length} слабые` : 'баланс'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: report.symmetry.score < 70 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: report.symmetry.score < 70 ? '#ef4444' : '#22c55e' }}>Симметрия {report.symmetry.score}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: DIM }}>Стимул {report.stimulus.scorePenalty ? `−${report.stimulus.scorePenalty}` : 'OK'}</span>
          {report.score.floors.length > 0 && <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444' }}>floor: {report.score.floors[0]}</span>}
        </div>
        <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', lineHeight: 1.45 }}>
          Выбери слабые зоны (1-2) + замеры + VBT → RSS-скор, verification и коррекции. Кнопка <b style={{ color: '#00e68a' }}>«Применить в ББ-авто»</b> отправит зоны с бонусом в конструктор. Объём/ACWR — из дневника, симметрия — из замеров.
        </div>
        {toast && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: 11 }}>{toast}</div>}
      </div>

      <div style={{ ...CARD, padding: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {TAB_DEFS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} aria-pressed={tab === t.id} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid', borderColor: tab === t.id ? '#00e68a' : '#1f3a5f', background: tab === t.id ? 'rgba(0,230,138,0.14)' : '#0a1629', color: tab === t.id ? '#00e68a' : DIM, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              {t.icon} {t.label}
            </button>
          ))}
          <button onClick={applyToConstructor} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>→ Применить в ББ-авто</button>
        </div>

        {tab === 'weak' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Отстающие — гранулярные зоны (1-2)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {GRANULAR_OPTS.map(o => (
                <button key={o.id} onClick={() => toggleWeak(o.id)} aria-pressed={state.weakManual.includes(o.id)} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid', borderColor: state.weakManual.includes(o.id) ? '#00e68a' : '#1f3a5f', background: state.weakManual.includes(o.id) ? 'rgba(0,230,138,0.14)' : '#0a1629', color: state.weakManual.includes(o.id) ? '#00e68a' : DIM, fontSize: 11 }}>{o.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>Авто-кандидаты: {report.weakCandidates.length ? report.weakCandidates.map(c => `${c.muscle}${c.granular ? `(${c.granular})` : ''} ${c.deltaPct}% [${c.source}]`).join(' · ') : '— баланс (дневник/объём/замеры не выдали)'}</div>
            <div style={{ fontSize: 10, color: DIM, background: '#0a1629', border: '1px solid #1f3a5f', borderRadius: 8, padding: '8px 10px' }}>
              Выбрано: {report.weakZonesGranular.join(', ') || '—'} → канонические: {report.weakMusclesCanonical.join(', ') || '—'} (×1.15 объём + бонус упражнения в ББ-авто)
            </div>
            <div style={{ fontSize: 10, color: '#fff', marginTop: 6, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 8, padding: '8px 10px' }}>
              Подсказка: две зоны одной мышцы (delt_mid+delt_rear) — можно, плечи+delt_mid — конфликт.
            </div>
          </div>
        )}

        {tab === 'symmetry' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Симметрия — замеры (см) + идеал Reeves</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              {['heightCm', 'weightKg', 'chest', 'waist', 'shoulderWidth', 'neck'].map(k => (
                <label key={k} style={{ fontSize: 10, color: DIM }}>{k}<br /><input value={state.circ[k] || ''} onChange={e => setState(s => ({ ...s, circ: { ...s.circ, [k]: e.target.value } }))} placeholder={k} style={{ width: '100%', marginTop: 2, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 11 }} /></label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              {['bicepL', 'bicepR', 'thighL', 'thighR', 'calfL', 'calfR', 'forearmL', 'forearmR'].map(k => (
                <label key={k} style={{ fontSize: 10, color: DIM }}>{k}<br /><input value={state.circ[k] || ''} onChange={e => setState(s => ({ ...s, circ: { ...s.circ, [k]: e.target.value } }))} placeholder={k} style={{ width: '100%', marginTop: 2, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 11 }} /></label>
              ))}
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: report.symmetry.score < 70 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${report.symmetry.score < 70 ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)'}`, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: report.symmetry.score < 70 ? '#ef4444' : '#22c55e' }}>Симметрия {report.symmetry.score}/100</div>
              <div style={{ fontSize: 10, color: DIM }}>{Object.entries(report.symmetry.ratios).map(([k, v]) => `${k} ${typeof v === 'number' ? v.toFixed(2) : v}`).join(' · ') || '— замеры не введены'}</div>
              <div style={{ fontSize: 10, color: report.symmetry.score < 70 ? '#ef4444' : DIM, marginTop: 4 }}>{report.symmetry.issues.join(' · ') || 'Пропорции в норме'}</div>
            </div>
          </div>
        )}

        {tab === 'stimulus' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Стимул — lengthened / pattern / compound (из плана)</div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: DIM }}>Глобально: lengthened {report.stimulus.global.lengthened} · mid {report.stimulus.global.midRange} · shortened {report.stimulus.global.shortened} · base {report.stimulus.global.compound} / iso {report.stimulus.global.isolation}</div>
              <div style={{ fontSize: 10, color: report.stimulus.issues.length ? '#f59e0b' : '#22c55e', marginTop: 4 }}>{report.stimulus.issues.join(' · ') || 'Стимул сбалансирован'}</div>
              {report.stimulus.bfrEligible.length > 0 && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 4 }}>BFR пригодны: {report.stimulus.bfrEligible.join(', ')} (20-30% 30-15-15-15 30с)</div>}
              <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>Паттерны: {Object.entries(report.stimulus.global.patterns).map(([k, v]) => `${k}:${v}`).join(' · ') || '—'}</div>
            </div>
            <div style={{ fontSize: 10, color: DIM, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
              План-баланс: {balance ? balance.issues.slice(0, 2).join(' · ') : '— нет плана (собери в ББ-авто)'} · <span style={{ color: ACCENT }}>→ Качество: детали в QualityHub</span>
            </div>
          </div>
        )}

        {tab === 'volume' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Объём — MEV/MAV/MRV (канон VolumeHub)</div>
            {factVolume ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {Object.entries(factVolume).slice(0, 8).map(([m, v]) => {
                  const lm = getVolumeLandmarks(level, m);
                  if (!lm) return null;
                  const sets = v.effectiveSets ?? v.directSets ?? 0;
                  const pct = lm.mrv ? Math.round(sets / lm.mrv * 100) : 0;
                  const status = sets < lm.mev ? 'ниже MEV' : sets <= lm.mav ? 'оптимум' : sets <= lm.mrv ? '→MRV' : '>MRV';
                  const col = sets < lm.mev ? '#f59e0b' : sets > lm.mrv ? '#ef4444' : '#22c55e';
                  return <div key={m} style={{ padding: '6px 8px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, color: DIM }}><b style={{ color: '#fff' }}>{MUSCLE_LABEL_RU[m] || m}</b> {sets} сет · MEV{lm.mev} MAV{lm.mav} MRV{lm.mrv} · <span style={{ color: col }}>{status} {pct}%</span></div>;
                })}
              </div>
            ) : <div style={{ fontSize: 10, color: DIM, background: '#0a1629', border: '1px solid #1f3a5f', borderRadius: 8, padding: '8px 10px' }}>Нет дневника за 7д — объём не посчитан. Введи тренировки или открой <b>→ Объём-хаб</b> для детальной таблицы.</div>}
            <div style={{ fontSize: 10, color: DIM, marginTop: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.14)', borderRadius: 8, padding: '8px 10px' }}>
              Канон MEV/MAV/MRV — в <b>📐 Объём-хаб → Объём</b> (Isratel, Schoenfeld). Здесь — чип-факт за 7д. Тоннаж/КПШ — в <b>→ Тоннаж</b>.
            </div>
          </div>
        )}

        {tab === 'recovery' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Восстановление — per-muscle ACWR + Unified snapshot</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {Object.entries(perMuscleAcwr).length ? Object.entries(perMuscleAcwr).map(([m, v]) => {
                const col = v.zone === 'dangerous' ? '#ef4444' : v.zone === 'caution' ? '#f59e0b' : v.zone === 'undertrained' ? '#3b82f6' : '#22c55e';
                return <span key={m} style={{ padding: '4px 8px', borderRadius: 999, background: `${col}14`, border: `1px solid ${col}33`, color: col, fontSize: 10, fontWeight: 700 }}>{m} {v.ratio} {v.zone}</span>;
              }) : <span style={{ fontSize: 10, color: DIM }}>Недостаточно дневника (≥4 сессии)</span>}
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, color: DIM }}>
              Unified: ACWR {acwr ? `${acwr.ratio.toFixed(2)} ${acwr.zone}` : '—'} · monotony {unifiedSnap?.monotony ?? '—'} · recovery {unifiedSnap?.recovery ?? '—'} · <span style={{ color: ACCENT }}>→ Интеллект → Нагрузка/Восстановление</span>
            </div>
            {report.score.floors.some(f => f.includes('ACWR')) && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 6 }}>⚠ ACWR danger — снизь объём на 25% для перегруженных мышц (Adherence-floor 0.75)</div>}
          </div>
        )}

        {tab === 'mobility' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>Мобильность — OHS 6 + VBT 20-25% гипертрофия</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsHeelsFlat} onChange={e => setState(s => ({ ...s, ohsHeelsFlat: e.target.checked }))} /> Пятки плоско</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={!state.ohsKneeValgus} onChange={e => setState(s => ({ ...s, ohsKneeValgus: !e.target.checked }))} /> Без вальгуса</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsHipBelowParallel} onChange={e => setState(s => ({ ...s, ohsHipBelowParallel: e.target.checked }))} /> Таз ниже паралл</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsTrunkUpright} onChange={e => setState(s => ({ ...s, ohsTrunkUpright: e.target.checked }))} /> Корпус upright</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsArmsOverMidfoot} onChange={e => setState(s => ({ ...s, ohsArmsOverMidfoot: e.target.checked }))} /> Руки над стопой</label>
              <label style={{ fontSize: 11, color: DIM, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={state.ohsLumbarNeutral} onChange={e => setState(s => ({ ...s, ohsLumbarNeutral: e.target.checked }))} /> Нейтраль поясницы</label>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: ohs.level === 'ok' ? 'rgba(34,197,94,0.08)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${ohs.level === 'ok' ? 'rgba(34,197,94,0.18)' : ohs.level === 'warn' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'}`, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ohs.level === 'ok' ? '#22c55e' : ohs.level === 'warn' ? '#f59e0b' : '#ef4444' }}>OHS {ohs.totalScore}/6 {ohs.level.toUpperCase()} · fail {ohs.failed} {ohs.primaryDriver ? `· ${ohs.primaryDriver}` : ''}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>{ohs.recommendation}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: DIM }}>Knee-to-wall см<br /><input value={state.kneeToWallCm} onChange={e => setState(s => ({ ...s, kneeToWallCm: e.target.value }))} placeholder="12" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
              <label style={{ fontSize: 11, color: DIM }}>Голеностоп °<br /><input value={state.ankleDeg} onChange={e => setState(s => ({ ...s, ankleDeg: e.target.value }))} placeholder="35" style={{ width: '100%', marginTop: 4, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} /></label>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: DIM }}>Heel 2.5см</span>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'better' }))} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'better' ? '#22c55e' : '#1f3a5f', background: state.heelRetest === 'better' ? 'rgba(34,197,94,0.14)' : '#0a1629', color: state.heelRetest === 'better' ? '#22c55e' : DIM, fontSize: 11 }}>Лучше</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: 'same' }))} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid', borderColor: state.heelRetest === 'same' ? '#f59e0b' : '#1f3a5f', background: state.heelRetest === 'same' ? 'rgba(245,158,11,0.14)' : '#0a1629', color: state.heelRetest === 'same' ? '#f59e0b' : DIM, fontSize: 11 }}>Без</button>
              <button onClick={() => setState(s => ({ ...s, heelRetest: '' }))} style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #1f3a5f', background: '#0a1629', color: DIM, fontSize: 11 }}>Сброс</button>
              <span style={{ fontSize: 10, color: DIM }}>OHS ≥{OHS_NORMS.kneeToWallCm.optimal}см norm</span>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>VBT — потеря скорости (гипертрофия 20-25%)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                <label style={{ fontSize: 10, color: DIM }}>Best м/с<br /><input value={state.vbtBest} onChange={e => setState(s => ({ ...s, vbtBest: e.target.value }))} placeholder="0.85" style={{ width: '100%', marginTop: 2, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Last м/с<br /><input value={state.vbtLast} onChange={e => setState(s => ({ ...s, vbtLast: e.target.value }))} placeholder="0.62" style={{ width: '100%', marginTop: 2, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
                <label style={{ fontSize: 10, color: DIM }}>Вес кг<br /><input value={state.vbtWeight} onChange={e => setState(s => ({ ...s, vbtWeight: e.target.value }))} placeholder="80" style={{ width: '100%', marginTop: 2, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 6, padding: '6px', fontSize: 11 }} /></label>
              </div>
              {vbt && <div style={{ fontSize: 10, color: vbt.exceeded ? '#ef4444' : '#22c55e', marginTop: 6 }}>{vbt.recommendation} {vbt.suggestedRirShift ? `(RIR ${vbt.suggestedRirShift > 0 ? '+' : ''}${vbt.suggestedRirShift})` : ''}</div>}
            </div>
            <textarea value={state.csvText} onChange={e => setState(s => ({ ...s, csvText: e.target.value }))} placeholder="Kinovea CSV (time,x,y) — опционально" style={{ width: '100%', height: 60, background: '#0a1629', color: '#fff', border: '1px solid #1f3a5f', borderRadius: 8, padding: '8px', fontSize: 11, fontFamily: 'monospace' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={handleCsvParse} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(0,230,138,0.14)', border: '1px solid #1f3a5f', color: '#00e68a', fontSize: 11, cursor: 'pointer' }}>📊 Разобрать Kinovea CSV</button>
              <button onClick={applyMobilityToProfile} style={{ padding: '6px 12px', borderRadius: 8, background: ohs.failed > 0 ? 'rgba(59,130,246,0.14)' : 'rgba(34,197,94,0.10)', border: `1px solid ${ohs.failed > 0 ? 'rgba(59,130,246,0.22)' : 'rgba(34,197,94,0.18)'}`, color: ohs.failed > 0 ? '#60a5fa' : '#22c55e', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>→ В профиль {ohs.failed ? `(${ohs.failed}/6)` : '(OK)'}</button>
            </div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 6 }}>OHS из <code>strength-sport-ohs</code> (канон WL) · VBT 20-25% гипертрофия (Wood 2026) · Enode/BlazePose reuse из WL. <span style={{ color: '#60a5fa' }}>→ Суставы и ортопедия</span> · <span style={{ color: '#a78bfa' }}>→ Анализ силы → VBT</span></div>
          </div>
        )}
      </div>

      <div style={{ ...CARD, padding: 12, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.16)' }}>
        <div style={{ fontSize: 11, color: DIM, marginBottom: 6 }}>Выбрано: {report.weakZonesGranular.join(' · ') || '— баланс'} · score {score} · ver {report.score.verification} {report.score.floors.join(' · ')}</div>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>{report.findings.slice(0, 3).join(' · ') || '—'}</div>
        {sLevel === 'critical' && <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>⚠️ CRITICAL — урезание MRV и коррекция до пика. Проверь OHS + объём.</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={applyToConstructor} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#06281c', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>→ Применить в ББ-авто ({report.weakZonesGranular.join(', ') || 'баланс'})</button>
          <button onClick={handleExport} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🖨 HTML</button>
          <button onClick={handleExportCsv} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📊 CSV</button>
        </div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 8 }}>Объём-канон: <b>📐 Объём-хаб</b> · Нагрузка-канон: <b>⚡ Интеллект</b> · Суставы: <b>🦴 Суставы и ортопедия</b> · Сила: <b>🏋️ Анализ силы</b> — без дублей, чипы read-only.</div>
      </div>
    </div>
  );
};

export default BBDiagnosticsHub;

import React, { useMemo } from 'react';
import { relativeStrengthFullReport, ipfGLPointsFor, type Sex } from '../../../engines/pro/relative-strength.engine';
import type { HubSnapshot } from './StrengthAnalysisHub';

const ACCENT = '#00e68a';

interface Props {
  snapshot?: HubSnapshot;
  onHubPatch?: (patch: Partial<HubSnapshot>) => void;
}

/** Отн. сила — отдельный мини-таб: сравнение очков вне категорий (DOTS/Wilks/IPF GL classic+equipped). Детали — таб «Нормативы». */
export const RelStrengthTab: React.FC<Props> = ({ snapshot }) => {
  const sex: Sex = snapshot?.sex ?? 'male';
  const bw = snapshot?.bw ?? 83;
  const total = (snapshot?.squat ?? 0) + (snapshot?.bench ?? 0) + (snapshot?.dead ?? 0);
  const report = useMemo(() => relativeStrengthFullReport(snapshot?.squat ?? 0, snapshot?.bench ?? 0, snapshot?.dead ?? 0, bw, sex), [snapshot, bw, sex]);
  const glEq = useMemo(() => ipfGLPointsFor(total, bw, sex, 'equipped', 'total'), [total, bw, sex]);
  const dotsBar = Math.min(100, (report.dots / 520) * 100);
  return (
    <div className="train-relstr" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>⚖️ Относительная сила — сравнение вне категорий</div>
      <div style={{ fontSize: 12, color: '#fff', marginBottom: 10, lineHeight: 1.5 }}>
        Очки позволяют сравнивать атлетов разного веса: тотал {total} кг при {bw} кг ({report.relative}×BW) — класс <b style={{ color: ACCENT }}>{report.classification.label}</b>.
        Разряды по категориям — таб «Нормативы», раскладка попыток — там же.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          { label: 'DOTS', value: report.dots, hint: 'BVDK 2019 · USAPL/USPA · 300 новичок / 380 опытный / 450 элита / 520 мировой', color: '#60a5fa' },
          { label: 'IPF GL classic', value: report.ipfGL, hint: 'Официальный IPF с 2020 · 60 КМС / 75 МС / 85 МСМК / 100+ мировой топ', color: ACCENT },
          { label: 'IPF GL equipped', value: glEq, hint: 'Та же формула, параметры экипировки — с классикой не сравнивать', color: '#f59e0b' },
          { label: 'Wilks (устарел)', value: report.wilks, hint: 'IPF до 2019 · оставлен для истории, смотрите DOTS/IPF GL', color: '#a855f7' },
        ].map(c => (
          <div key={c.label} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{c.value}</div>
            <div style={{ fontSize: 9, color: '#fff', marginTop: 2, lineHeight: 1.3 }}>{c.hint}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#fff' }}>
        <span>DOTS-шкала</span><span>{report.dots} / 520 (мировой)</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.max(2, dotsBar))}%`, borderRadius: 6, background: 'linear-gradient(90deg,#60a5fa,#a855f7)' }} />
      </div>
      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
        💡 Не смотрите только на тотал: 600 кг при 60 кг (DOTS ~520) сильнее, чем 700 кг при 110 кг (DOTS ~430). Сравнивайте именно DOTS/IPF GL.
      </div>
    </div>
  );
};

export default React.memo(RelStrengthTab);

/** ToolsHub.tsx — DEPRECATED: PRI вынесен в Интеллект → Авторегуляция (единственный источник).
 * Оставлен как редирект, чтобы не ломать deep-link. */
import React from 'react';

const ACCENT = '#a855f7';
const DIM = '#fff';

export const ToolsHub: React.FC = () => {
  return (
    <div style={{ padding: 14, textAlign:'center' }}>
      <div style={{ fontSize:13, fontWeight:800, color:ACCENT, marginBottom:6 }}>🧠 PRI → Интеллект → Авторегуляция</div>
      <div style={{ fontSize:11, color:DIM, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.18)', borderRadius:10, padding:'10px 12px', lineHeight:1.5 }}>
        Канон теперь в <b>⚡ Интеллект тренировки → Авторегуляция</b> (PRI + pro-регуляция веса/объёма/RIR + RPE↔вес).<br/>Откройте <b>Тренировки → ⚡ Интеллект → ⚙️ Авторегуляция</b>.
      </div>
    </div>
  );
};

export default ToolsHub;

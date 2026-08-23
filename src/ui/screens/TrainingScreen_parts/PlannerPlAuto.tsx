/** PlannerPlAuto.tsx — dedicated цельная ПЛ-панель (авто-планировщик пауэрлифтинга).
 * Обёртывает SRCBBScreen track="pl": каталог силовых циклов, ПМ-прогрессия, недельный план,
 * мост план→сессия, блины, авторегуляция, пиковая фаза, восстановление, безопасность. */
import React from 'react';
import { SRCBBScreen } from '../SRCBBScreen';

export const PlannerPlAuto: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ background:'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(59,130,246,0.08))', border:'1px solid rgba(0,230,138,0.18)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>🏆</span>
        <div><div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Пауэрлифтинг — авто-планировщик</div><div style={{ fontSize:10, color:'#fff', opacity:0.9 }}>Циклы · прогрессия · план · графики · соревнования</div></div>
      </div>
      <SRCBBScreen track="pl" />
    </div>
  );
};

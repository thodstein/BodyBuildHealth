/** PlannerBbAuto.tsx — dedicated ББ-панель с пошаговым конструктором BbAutoConstructor.
 *  Полный поток: Параметры → PED+WorkMax → Сплит → План с комментариями → Качество → Коррекция.
 *  Все PRO-фичи: PED-адаптация, MRV-guard, auto-reg, ACWR, inline editing. */
import React from 'react';
import { BbAutoConstructor } from './BbAutoConstructor';

export const PlannerBbAuto: React.FC = () => {
  return (
    <div className="hub-bb tp-wrap-bb" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      <div className="hub-head tp-wrap-head" style={{ background:'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(236,72,153,0.08))', border:'1px solid rgba(0,230,138,0.18)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
        <span className="tp-wrap-icon" style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#00e68a,#00c853)', color:'#000', fontWeight:900, fontSize:16 }}>💪</span>
        <div><div className="tp-wrap-title" style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Бодибилдинг — авто-конструктор</div><div className="tp-wrap-sub" style={{ fontSize:10, color:'#fff', opacity:0.9 }}>Сплиты · объём · план · качество · коррекция</div></div>
      </div>
      <BbAutoConstructor />
    </div>
  );
};

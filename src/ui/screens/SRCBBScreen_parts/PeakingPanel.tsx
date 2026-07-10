/** PeakingPanel.tsx — ОБНОВЛЁН: PL-taper перенесён в TaperPlannerTab (единый тапер-калькулятор).
 *  Здесь: только BB шоу-пик + кнопка перехода к TaperPlannerTab для PL/SRCP. */
import React from 'react';

const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, margin: '6px 0' };
const ACCENT = '#00e68a';
const BTN: React.CSSProperties = { width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 14, minHeight: 48 };

export const PeakingPanel: React.FC<{ defaultKind?: 'pl' | 'bb' }> = ({ defaultKind }) => {
  const kind = defaultKind || 'pl';

  if (kind === 'bb') {
    return <BbPeakingRedirect />;
  }

  // PL — перенаправление в TaperPlannerTab
  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={CARD}>
        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 8, textAlign: 'center' }}>🏋️ PL: Taper + Соревнование</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 16, textAlign: 'center' }}>
          Полный инструмент taper/пик перенесён в единый калькулятор:<br />
          📍 <b>Планировщик → Инструменты → Taper-планер</b><br />
          📍 <b>Калькуляторы → Периодизация → Taper</b><br /><br />
          Там: taper-кривая (1-3 нед по усталости), понедельный план, прикиды (opener/2nd/3rd),
          весовая категория, таймлайн дня, протоколы восстановления, ментальные рутины,
          разминка, последние тяжёлые дни, инструкции соревновательного дня.
        </div>
        <button onClick={() => { try { localStorage.setItem('he_taper_planner_redirect', '1'); window.dispatchEvent(new CustomEvent('opencode-navigate', { detail: { tab: 'calc_taper' } })); } catch {} }}
          style={BTN}>
          🔻 Открыть Taper-планер
        </button>
      </div>
    </div>
  );
};

const BbPeakingRedirect: React.FC = () => {
  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={CARD}>
        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 8, textAlign: 'center' }}>🏆 BB: Шоу-пик</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 16, textAlign: 'center' }}>
          Инструмент шоу-пика перенесён в единый калькулятор:<br />
          📍 <b>Калькуляторы → Периодизация → Taper</b> (режим BB)<br /><br />
          Там: 7-дневная углеводная загрузка, водная манипуляция, натрий, памп-тренировки, позирование.
        </div>
        <button onClick={() => { try { window.dispatchEvent(new CustomEvent('opencode-navigate', { detail: { tab: 'periodization_hub', sub: 'taper' } })); } catch {} }}
          style={BTN}>
          🔻 Открыть Taper-планер (BB)
        </button>
      </div>
    </div>
  );
};

export default PeakingPanel;

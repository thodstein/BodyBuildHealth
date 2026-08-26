// @ts-nocheck
import React from 'react';
import { InfoErrorBoundary } from './SupportScreenData';

/**
 * Домашний (hero) экран вкладки «Поддержка».
 * Источник JSX: SupportScreen.tsx строки 2429–2479.
 * Все state-setter'ы и значения приходят через `s` проп.
 */
export const SupportHomeView: React.FC<{ s: Record<string, any> }> = ({ s }) => {
  const {
    setSection,
    setTab,
    setSupportView,
    setCalcView,
    setInfoView,
    setProtocolTab,
  } = s;

  // Hero остаётся на главной, но контент больше не перекрывается нижним дашбордом:
  // контейнер hero занимает доступную высоту с учётом нижнего бара (64px + safe-area), внутренний паддинг тоже с запасом.
  const CARD_BASE: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 16px', borderRadius: 18, cursor: 'pointer', textAlign: 'left', width: '100%',
    border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 6px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
    transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  };
  const cardGlow = (accent: string): React.CSSProperties => ({
    background: `linear-gradient(135deg, ${accent}14, rgba(24,24,27,0.55))`,
  });

  const renderCard = (onClick: () => void, icon: string, bg: string, title: string, titleColor: string, desc: string, accent: string) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}55`; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 36px rgba(0,0,0,0.45), 0 0 0 1px ${accent}22 inset`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)'; }}
      style={{ ...CARD_BASE, ...cardGlow(accent) }}
    >
      <div style={{ width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: bg, fontSize: 26, boxShadow: `0 4px 16px ${accent}25`, border: `1px solid ${accent}22` }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 850, marginBottom: 3, color: titleColor, letterSpacing: '-0.2px', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.35 }}>{desc}</div>
      </div>
      <span style={{ width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}14`, border: `1px solid ${accent}22`, color: accent, fontSize: 16, flexShrink: 0, fontWeight: 700 }}>→</span>
    </div>
  );

  return (
    <InfoErrorBoundary label="Главная бады">
      {/* ХЕРО — на весь экран, фиксирован, вкладки компактно внизу. Нижний дашборд (SupportScreen bottom bar, z200) поверх херо, но контент херо имеет запас 80px+safe-area чтобы не перекрывался */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        <img src="/support-hero.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.38) 38%, rgba(0,0,0,0.82) 68%, rgba(0,0,0,0.92) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(560px 360px at 16% 10%, rgba(0,230,138,0.20), transparent 55%), radial-gradient(520px 320px at 86% 18%, rgba(139,92,246,0.16), transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px 16px calc(80px + env(safe-area-inset-bottom, 0px))', gap: 14, overflowY: 'auto' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 20, background: 'rgba(0,230,138,0.14)', border: '1px solid rgba(0,230,138,0.25)', color: '#00e68a', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.4px', backdropFilter: 'blur(10px)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 6, background: '#00e68a', boxShadow: '0 0 10px rgba(0,230,138,0.7)', display: 'inline-block' }} /> БЛОК БАД · ПОДДЕРЖКА
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: '10px 0 6px', textShadow: '0 3px 18px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.15)', letterSpacing: '-0.9px', lineHeight: 0.95 }}>Поддержка</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', margin: 0, lineHeight: 1.45, textShadow: '0 2px 12px rgba(0,0,0,0.8)', maxWidth: 520 }}>
              Фармакологическая поддержка, пептиды и препараты для снижения рисков — калькулятор, каталог, протоколы и исследования.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '5px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)' }}>28 механизмов ТЗ</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '5px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)' }}>435 веществ</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '5px 9px', borderRadius: 20, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.20)', color: '#00e68a', backdropFilter: 'blur(10px)' }}>Механизм-ориентировано</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {renderCard(() => { setSection('generator'); setTab('calculator'); setSupportView('calc'); setCalcView('main'); }, '🧮', 'rgba(0,230,138,0.18)', 'Калькулятор поддержки', '#00e68a', 'Расчёт рисков, генератор стеков, нейропротекция, миксы и план приёма', '#00e68a')}
            {renderCard(() => { setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); }, '📚', 'rgba(96,165,250,0.18)', 'Общая информация', '#60a5fa', 'Каталог · синергии · взаимодействия · исследования · калькуляторы', '#60a5fa')}
            {renderCard(() => { setSection('protocols'); setProtocolTab('pct'); }, '📋', 'rgba(139,92,246,0.18)', 'Примерные протоколы поддержки', '#a78bfa', 'ПКТ · Фертильность · ГЗТ · Нейро · Суставы · Акне — фазовые модели по анализам', '#8b5cf6')}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.4, padding: '2px 0 0' }}>
            Все протоколы — ознакомительные. Назначение — только врачом.
          </div>
        </div>
      </div>
    </InfoErrorBoundary>
  );
};
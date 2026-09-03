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
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 3px 12px rgba(0,0,0,0.30)',
    transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
  };
  const cardGlow = (accent: string): React.CSSProperties => ({
    background: `rgba(18,18,20,0.62)`,
  });

  const renderCard = (key: string, onClick: () => void, icon: string, bg: string, title: string, titleColor: string, desc: string, accent: string) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className="support-hero-card"
      data-key={key}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}40`; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 18px rgba(0,0,0,0.32), 0 0 0 1px ${accent}18 inset`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 3px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)'; }}
      style={{ ...CARD_BASE, ...cardGlow(accent) }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: bg, fontSize: 18, boxShadow: `0 3px 10px ${accent}20`, border: `1px solid ${accent}18` }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2, color: titleColor, letterSpacing: '-0.2px', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: '#fff', lineHeight: 1.3 }}>{desc}</div>
      </div>
      <span style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}12`, border: `1px solid ${accent}18`, color: accent, fontSize: 13, flexShrink: 0, fontWeight: 700 }}>→</span>
    </div>
  );

  return (
    <InfoErrorBoundary label="Главная бады">
      {/* ХЕРО — на весь экран, без стекла. Картинка полностью видна: градиент только снизу 30% */}
      <div className="support-hero" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        <img src="/support-hero.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 62%, rgba(0,0,0,0.18) 76%, rgba(0,0,0,0.58) 88%, rgba(0,0,0,0.78) 100%)' }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '12px 12px calc(64px + env(safe-area-inset-bottom, 0px))', gap: 10, overflowY: 'auto' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 20, background: 'rgba(0,230,138,0.14)', border: '1px solid rgba(0,230,138,0.22)', color: '#00e68a', fontSize: 9, fontWeight: 800, letterSpacing: '0.4px' }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: '#00e68a', boxShadow: '0 0 8px rgba(0,230,138,0.6)', display: 'inline-block' }} /> БЛОК БАД · ПОДДЕРЖКА
            </div>
            <h1 className="support-hero-title" style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '8px 0 4px', textShadow: '0 2px 12px rgba(0,0,0,0.9)', letterSpacing: '-0.6px', lineHeight: 1 }}>Поддержка</h1>
            <p className="support-hero-sub" style={{ fontSize: 11, color: '#fff', margin: 0, lineHeight: 1.4, textShadow: '0 1px 6px rgba(0,0,0,0.8)', maxWidth: 480 }}>
              Фарм-поддержка, пептиды и препараты для снижения рисков
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 20, background: 'rgba(18,18,20,0.55)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>28 механизмов</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 20, background: 'rgba(18,18,20,0.55)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>435 веществ</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 20, background: 'rgba(18,18,20,0.55)', border: '1px solid rgba(0,230,138,0.16)', color: '#00e68a' }}>ТЗ-модель</span>
            </div>
          </div>
          <div className="support-hero-cards" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renderCard('calc', () => { setSection('generator'); setTab('calculator'); setSupportView('calc'); setCalcView('main'); }, '🧮', 'rgba(0,230,138,0.14)', 'Калькулятор поддержки', '#00e68a', 'Расчёт рисков · стеки · нейропротекция', '#00e68a')}
            {renderCard('info', () => { setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); }, '📚', 'rgba(96,165,250,0.14)', 'Общая информация', '#60a5fa', 'Каталог · синергии · исследования', '#60a5fa')}
            {renderCard('protocols', () => { setSection('protocols'); setProtocolTab('pct'); }, '📋', 'rgba(139,92,246,0.14)', 'Протоколы поддержки', '#a78bfa', 'ПКТ · Фертильность · ГЗТ · Нейро · Суставы', '#8b5cf6')}
          </div>
          <div style={{ fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>
            Ознакомительно. Назначение — только врачом.
          </div>
        </div>
      </div>
    </InfoErrorBoundary>
  );
};
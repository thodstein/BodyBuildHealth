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

  return (
    <InfoErrorBoundary label="Главная бады">
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        <img src="/support-hero.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.85))' }} />
        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px 16px 80px' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 2px 14px rgba(0,0,0,0.9)' }}>Поддержка</h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px', lineHeight: 1.3, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
            Фармакологическая поддержка, пептиды и предлагаемые препараты поддержки для уменьшения рисков
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div onClick={() => { setSection('generator'); setTab('calculator'); setSupportView('calc'); setCalcView('main'); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--text)', transition: 'all 0.2s',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(0,230,138,0.15)', fontSize: 24 }}>🧮</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: 'var(--accent)' }}>Калькулятор поддержки</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>Расчёт рисков, генератор стеков, протоколы нейропротекции, миксы, план приёма</div>
              </div>
              <span style={{ color: 'var(--accent)', fontSize: 18, opacity: 0.6 }}>→</span>
            </div>

            <div onClick={() => { setSection('home'); setTab('main'); setSupportView('calc'); setCalcView('info'); setInfoView('catalog'); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--text)', transition: 'all 0.2s',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(96,165,250,0.15)', fontSize: 24 }}>📚</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: '#60a5fa' }}>Общая информация</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>Каталог, синергии, взаимодействия, исследования, калькуляторы</div>
              </div>
              <span style={{ color: '#60a5fa', fontSize: 18, opacity: 0.6 }}>→</span>
            </div>
            {/* Тренировочные миксы — удалены по запросу пользователя */}

            {/* Примерные протоколы поддержки — одна кнопка */}
            <div onClick={() => { setSection('protocols'); setProtocolTab('pct'); }} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--text)', transition: 'all 0.2s',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(139,92,246,0.15)', fontSize: 24 }}>📋</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: '#8b5cf6' }}>Примерные протоколы поддержки</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>ПКТ · Фертильность · ГЗТ · Нейро · Суставы · Акне</div>
              </div>
              <span style={{ color: '#8b5cf6', fontSize: 18, opacity: 0.6 }}>→</span>
            </div>
          </div>
        </div>
      </div>
    </InfoErrorBoundary>
  );
};
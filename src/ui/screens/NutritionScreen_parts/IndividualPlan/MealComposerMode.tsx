import React, { useState } from 'react';
import type { AdvancedFilter } from '../../../../engines/kbju-food-match.engine';

export type ComposerMode = 'basic' | 'advanced';

interface Props {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  advancedFilter: AdvancedFilter;
  onAdvancedFilterChange: (f: AdvancedFilter) => void;
}

const btnCardStyle: React.CSSProperties = {
  flex: 1, minWidth: 0,
  padding: '12px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'center',
  background: 'rgba(24,24,27,0.6)', border: '1px solid rgba(255,255,255,0.06)',
  color: '#fff', fontWeight: 600, fontSize: 10,
  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
};

const activeCardStyle: React.CSSProperties = {
  ...btnCardStyle,
  borderColor: 'rgba(0,230,138,0.3)',
  background: 'rgba(0,230,138,0.08)',
  boxShadow: '0 0 16px rgba(0,230,138,0.06)',
};

const popupOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 110,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'rgba(0,0,0,0.7)',
};

const popupSheet: React.CSSProperties = {
  width: '100%', maxWidth: 400,
  padding: '14px 20px 28px', borderRadius: '20px 20px 0 0',
  background: '#18181b', boxShadow: '0 -4px 30px rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none',
  maxHeight: '75vh', overflowY: 'auto', boxSizing: 'border-box',
};

const handle: React.CSSProperties = {
  width: 36, height: 4, borderRadius: 2,
  background: 'rgba(255,255,255,0.15)', margin: '0 auto 16px',
};

const chipActive: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 9, fontWeight: 600,
  background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.25)',
  color: '#00e68a', transition: 'all 0.15s',
};

const chipInactive: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 9, fontWeight: 500,
  background: '#202023', border: '1px solid rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)', transition: 'all 0.15s',
};

const sliderStyle: React.CSSProperties = {
  width: '100%', margin: '4px 0 8px',
  accentColor: '#00e68a', height: 6,
};

export const MealComposerMode: React.FC<Props> = ({
  mode, onModeChange, advancedFilter, onAdvancedFilterChange,
}) => {
  const [showAdvSettings, setShowAdvSettings] = useState(false);

  const toggleFilterFlag = (key: 'excludeProcessed' | 'excludeHighGI' | 'excludeAtherogenic' | 'excludeGlycation') => {
    onAdvancedFilterChange({ ...advancedFilter, [key]: !advancedFilter[key] });
  };

  const setFilterValue = (key: 'diaasMin' | 'giMax' | 'pralMin' | 'pralMax' | 'fiberMin' | 'bbQualityMin' | 'aminoScoreMin', value: number | undefined) => {
    onAdvancedFilterChange({ ...advancedFilter, [key]: value });
  };

  const setTierMin = (t: 'basic' | 'mid' | 'max' | undefined) => {
    onAdvancedFilterChange({ ...advancedFilter, tierMin: t });
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        ⚙️ Режим компоновщика
      </div>

      {/* Mode selection buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: mode === 'advanced' ? 8 : 0 }}>
        <div
          style={mode === 'basic' ? activeCardStyle : btnCardStyle}
          onClick={() => onModeChange('basic')}
        >
          <span style={{ fontSize: 18 }}>📊</span>
          <span>Обычный</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
            Подбор по КБЖУ
          </span>
        </div>
        <div
          style={mode === 'advanced' ? { ...activeCardStyle, borderColor: 'rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.08)', boxShadow: '0 0 16px rgba(139,92,246,0.06)' } : btnCardStyle}
          onClick={() => onModeChange('advanced')}
        >
          <span style={{ fontSize: 18 }}>🧬</span>
          <span>Продвинутый</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
            DIAAS · GI · PRAL · Обработка
          </span>
        </div>
        {mode === 'advanced' && (
          <div
            style={showAdvSettings ? { ...activeCardStyle, borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)', boxShadow: '0 0 16px rgba(245,158,11,0.06)' } : btnCardStyle}
            onClick={() => setShowAdvSettings(true)}
          >
            <span style={{ fontSize: 18 }}>🎛️</span>
            <span>Фильтры</span>
            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
              Настроить параметры
            </span>
          </div>
        )}
      </div>

      {/* Active advanced filter chips summary */}
      {mode === 'advanced' && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {advancedFilter.diaasMin !== undefined && (
            <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.15)' }}>
              DIAAS ≥ {advancedFilter.diaasMin}
            </span>
          )}
          {advancedFilter.giMax !== undefined && (
            <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.15)' }}>
              GI ≤ {advancedFilter.giMax}
            </span>
          )}
          {advancedFilter.bbQualityMin !== undefined && (
            <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.15)' }}>
              Качество ≥ {advancedFilter.bbQualityMin}
            </span>
          )}
          {advancedFilter.fiberMin !== undefined && (
            <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.15)' }}>
              Клетч. ≥ {advancedFilter.fiberMin}г
            </span>
          )}
          {advancedFilter.aminoScoreMin !== undefined && (
            <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.15)' }}>
              Амино ≥ {advancedFilter.aminoScoreMin}
            </span>
          )}
          {advancedFilter.tierMin && (
            <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.15)' }}>
              Тир ≥ {advancedFilter.tierMin}
            </span>
          )}
          {advancedFilter.excludeProcessed && <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>Без обработки</span>}
          {advancedFilter.excludeHighGI && <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>Без выс. GI</span>}
          {advancedFilter.excludeAtherogenic && <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>Без атероген.</span>}
          {advancedFilter.excludeGlycation && <span style={{ fontSize: 7, padding: '2px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>Без гликации</span>}
          {!advancedFilter.diaasMin && !advancedFilter.giMax && !advancedFilter.bbQualityMin && !advancedFilter.fiberMin && !advancedFilter.aminoScoreMin && !advancedFilter.tierMin && !advancedFilter.excludeProcessed && !advancedFilter.excludeHighGI && !advancedFilter.excludeAtherogenic && !advancedFilter.excludeGlycation && (
            <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>Фильтры не заданы — показываются все продукты</span>
          )}
        </div>
      )}

      {/* Advanced settings popup */}
      {showAdvSettings && (
        <div style={popupOverlay} onClick={() => setShowAdvSettings(false)}>
          <div onClick={e => e.stopPropagation()} style={popupSheet}>
            <div style={handle} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              🎛️ Параметры продвинутого поиска
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
              Настройте фильтры для отбора продуктов по параметрам полезности
            </div>

            {/* DIAAS */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#a78bfa' }}>🧬 DIAAS (мин)</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{advancedFilter.diaasMin ?? '—'}</span>
              </div>
              <input type="range" min="0" max="1.5" step="0.05" value={advancedFilter.diaasMin || 0}
                onChange={e => setFilterValue('diaasMin', +e.target.value > 0 ? +e.target.value : undefined)}
                style={sliderStyle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
                <span>0</span><span>0.5</span><span>1.0 (отлично)</span><span>1.5</span>
              </div>
            </div>

            {/* GI max */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#f97316' }}>🍬 ГИ (макс)</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{advancedFilter.giMax ?? '—'}</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={advancedFilter.giMax || 100}
                onChange={e => setFilterValue('giMax', +e.target.value < 100 ? +e.target.value : undefined)}
                style={sliderStyle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
                <span>0</span><span>55 (низкий)</span><span>70 (средний)</span><span>100</span>
              </div>
            </div>

            {/* BB Quality min */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#00e68a' }}>⭐ Качество (мин)</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{advancedFilter.bbQualityMin ?? '—'}</span>
              </div>
              <input type="range" min="1" max="10" step="1" value={advancedFilter.bbQualityMin || 1}
                onChange={e => setFilterValue('bbQualityMin', +e.target.value > 1 ? +e.target.value : undefined)}
                style={sliderStyle} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: 'rgba(255,255,255,0.3)' }}>
                <span>1</span><span>5</span><span>7 (хорошо)</span><span>10</span>
              </div>
            </div>

            {/* Fiber min */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e' }}>🌿 Клетчатка (мин г/100г)</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{advancedFilter.fiberMin ?? '—'}</span>
              </div>
              <input type="range" min="0" max="15" step="1" value={advancedFilter.fiberMin || 0}
                onChange={e => setFilterValue('fiberMin', +e.target.value > 0 ? +e.target.value : undefined)}
                style={sliderStyle} />
            </div>

            {/* Amino score min */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa' }}>💪 Амино-скор (мин)</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{advancedFilter.aminoScoreMin ?? '—'}</span>
              </div>
              <input type="range" min="0" max="8" step="1" value={advancedFilter.aminoScoreMin || 0}
                onChange={e => setFilterValue('aminoScoreMin', +e.target.value > 0 ? +e.target.value : undefined)}
                style={sliderStyle} />
            </div>

            {/* Tier min */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#a855f7', marginBottom: 4 }}>🏷️ Мин. тир продукта</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['basic', 'mid', 'max'] as const).map(t => (
                  <button key={t} onClick={() => setTierMin(advancedFilter.tierMin === t ? undefined : t)}
                    style={advancedFilter.tierMin === t ? chipActive : chipInactive}>
                    {t === 'basic' ? '🟢 Базовый' : t === 'mid' ? '🟡 Средний' : '🔴 Премиум'}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle filters */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>🚫 Исключить</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {([
                  ['excludeProcessed', '🏭 Обработанные'],
                  ['excludeHighGI', '🍬 Высокий ГИ (>70)'],
                  ['excludeAtherogenic', '🫀 Атерогенные'],
                  ['excludeGlycation', '🔥 Гликирующие'],
                ] as ['excludeProcessed' | 'excludeHighGI' | 'excludeAtherogenic' | 'excludeGlycation', string][]).map(([key, label]) => (
                  <button key={key} onClick={() => toggleFilterFlag(key)}
                    style={advancedFilter[key] ? chipActive : chipInactive}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { onAdvancedFilterChange({}); setShowAdvSettings(false); }} style={{
                flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                background: '#202023', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
              }}>Сбросить всё</button>
              <button onClick={() => setShowAdvSettings(false)} style={{
                flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: 'linear-gradient(135deg,#00e68a,#00c8a0)', border: 'none', color: '#000',
              }}>✓ Применить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealComposerMode;

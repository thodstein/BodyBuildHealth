/**
 * StorageErrorBanner - Displays storage-related errors and warnings
 * Handles quota exceeded, validation errors, and provides recovery actions
 */

import React, { useState, useEffect } from 'react';
import { getStorageInfo } from '../diary-storage-v2';

interface StorageErrorBannerProps {
  error: string | null;
  onDismiss: () => void;
  onExport?: () => string;
  onClearOldData?: () => void;
}

export const StorageErrorBanner: React.FC<StorageErrorBannerProps> = ({
  error,
  onDismiss,
  onExport,
  onClearOldData,
}) => {
  const [storageInfo, setStorageInfo] = useState({ daysStored: 0, estimatedSizeKB: 0, version: 0 });
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    setStorageInfo(getStorageInfo());
  }, []);
  
  if (!error) return null;
  
  const isQuotaError = error.includes('квот') || error.includes('quota') || error.includes('переполнено');
  const isValidationError = error.includes('валид') || error.includes('valid');
  
  const handleExportAndClear = () => {
    if (onExport) {
      const json = onExport();
      try {
        const blob = new Blob([json], { type: 'application/json' });
        if (typeof URL.createObjectURL === 'function') {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `diary_backup_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL?.(url);
        }
      } finally {
        onClearOldData?.();
      }
    }
  };
  
  const accent = isQuotaError ? '#ef4444' : '#f59e0b';

  return (
    <div role="alert" className="nut-storageerr nd-storeerr" style={{
      padding: 12, borderRadius: 16,
      background: `linear-gradient(135deg, ${accent}12, rgba(24,24,27,0.9))`,
      border: `1px solid ${accent}30`,
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: `${accent}1e`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{isQuotaError ? '💾' : '⚠️'}</span>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: -0.2 }}>
              {isQuotaError ? 'Хранилище переполнено' : 'Ошибка данных'}
            </h3>
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>
            {error}
          </p>

          {/* Storage info */}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              aria-expanded={showDetails}
              style={{ padding: '8px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', minHeight: 44,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)' }}
            >
              {showDetails ? '▲ Скрыть детали' : '▼ Детали хранилища'}
            </button>

            {showDetails && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.65)', display: 'flex', flexDirection: 'column', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
                <div>Дней в дневнике: <b style={{ color: '#fff' }}>{storageInfo.daysStored}</b></div>
                <div>Размер данных: <b style={{ color: '#fff' }}>{storageInfo.estimatedSizeKB.toFixed(1)} KB</b></div>
                <div>Версия формата: <b style={{ color: '#fff' }}>{storageInfo.version}</b></div>
              </div>
            )}
          </div>

          {/* Recovery actions */}
          {isQuotaError && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={handleExportAndClear}
                className="nd-storebtn"
                style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 700, fontSize: 12, minHeight: 48,
                  boxShadow: '0 4px 16px rgba(239,68,68,0.25)' }}
              >
                💾 Экспорт и очистка старых
              </button>

              {onClearOldData && (
                <button
                  onClick={onClearOldData}
                  className="nd-storebtn"
                  style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)',
                    fontWeight: 600, fontSize: 12, minHeight: 48 }}
                >
                  🗑 Старше 90 дней
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="nd-storedismiss"
          aria-label="Закрыть"
          style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14,
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default StorageErrorBanner;

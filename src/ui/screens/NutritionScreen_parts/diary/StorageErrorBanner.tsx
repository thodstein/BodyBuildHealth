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
  
  return (
    <div className={`nut-storageerr border rounded-lg p-4 mb-4 ${isQuotaError ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <div className="flex justify-between items-start">
        <div className={`flex-1 ${isQuotaError ? 'bg-red-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{isQuotaError ? '⚠️' : '⚠️'}</span>
            <h3 className={`font-semibold ${isQuotaError ? 'text-red-800' : 'text-yellow-800'}`}>
              {isQuotaError ? 'Ошибка хранилища' : 'Ошибка данных'}
            </h3>
          </div>
          
          <p className={`text-sm ${isQuotaError ? 'text-red-700' : 'text-yellow-700'}`}>
            {error}
          </p>
          
          {/* Storage info */}
          <div className="mt-2 text-xs text-gray-600">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-500 hover:text-blue-700"
            >
              {showDetails ? 'Скрыть детали' : 'Показать детали'}
            </button>
            
            {showDetails && (
              <div className="mt-2 p-2 bg-white rounded border">
                <div>Дней в дневнике: {storageInfo.daysStored}</div>
                <div>Размер данных: {storageInfo.estimatedSizeKB.toFixed(1)} KB</div>
                <div>Версия формата: {storageInfo.version}</div>
              </div>
            )}
          </div>
          
          {/* Recovery actions */}
          {isQuotaError && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={handleExportAndClear}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Экспортировать и очистить старые данные
              </button>
              
              {onClearOldData && (
                <button
                  onClick={onClearOldData}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Очистить данные старше 90 дней
                </button>
              )}
            </div>
          )}
        </div>
        
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-700 ml-2"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default StorageErrorBanner;

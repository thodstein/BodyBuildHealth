import React, { useRef, useState } from 'react';
import { theme } from './ProfileComponents';
import {
  collectBackup,
  exportBackup,
  exportToJSON,
  importBackup,
  parseBackup,
  softClear,
} from '../../../core/data-backup';

export function DataBackupSection() {
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSave = async () => {
    setBusy(true);
    try {
      await exportBackup();
      setStatus('✅ Файл готов — поделитесь им с собой (Избранное) или скопируйте в буфер');
    } catch (e: any) {
      setStatus('❌ ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    setBusy(true);
    try {
      const b = await collectBackup();
      await navigator.clipboard.writeText(exportToJSON(b));
      setStatus('✅ Скопировано в буфер — отправьте себе в Избранное');
    } catch (e: any) {
      setStatus('❌ ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    f.text()
      .then(async (txt) => {
        try {
          const b = parseBackup(txt);
          await importBackup(b);
          setStatus('✅ Данные восстановлены. Перезагрузка…');
          setTimeout(() => window.location.reload(), 600);
        } catch (err: any) {
          setStatus('❌ ' + (err?.message || 'Не удалось прочитать файл'));
          setBusy(false);
        }
      })
      .catch((err: any) => {
        setStatus('❌ ' + (err?.message || 'Не удалось прочитать файл'));
        setBusy(false);
      });
    e.target.value = '';
  };

  const onClear = async () => {
    setConfirmClear(false);
    setBusy(true);
    try {
      await softClear();
      setStatus('✅ Все данные очищены (профиль и сессия сохранены). Перезагрузка…');
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      setStatus('❌ ' + (e?.message || e));
      setBusy(false);
    }
  };

  const card: React.CSSProperties = {
    background: theme.glassBg,
    backdropFilter: theme.blur,
    WebkitBackdropFilter: theme.blur,
    borderRadius: theme.cardRadius,
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 16,
  };

  const btn = (accent: boolean): React.CSSProperties => ({
    flex: 1,
    minHeight: 44,
    padding: '10px 12px',
    borderRadius: 12,
    border: accent ? `1px solid ${theme.accent}` : '1px solid rgba(255,255,255,0.12)',
    background: accent ? theme.accent : 'rgba(255,255,255,0.06)',
    color: accent ? '#0b0e13' : '#ebebf5',
    fontSize: 13,
    fontWeight: 600,
    cursor: busy ? 'wait' : 'pointer',
    textAlign: 'center',
    opacity: busy ? 0.6 : 1,
  });

  const dangerBtn: React.CSSProperties = {
    ...btn(false),
    border: '1px solid rgba(255,90,90,0.45)',
    background: 'rgba(255,90,90,0.10)',
    color: '#ff8a8a',
  };

  return (
    <div style={card}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '-0.3px',
          color: '#ebebf5',
          marginBottom: 4,
        }}
      >
        📤 Резервное копирование данных
      </div>
      <div
        style={{
          fontSize: 12,
          color: theme.textDim,
          marginBottom: 12,
          lineHeight: 1.4,
        }}
      >
        Сохраните всё состояние приложения (тренировки, анализы, поддержка, профиль) одним
        JSON-файлом. В Telegram Mini App файл можно отправить себе в «Избранное».
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button style={btn(true)} onClick={onSave} disabled={busy}>
          📤 Сохранить данные (JSON)
        </button>
        <button style={btn(false)} onClick={onCopy} disabled={busy}>
          📋 Копировать JSON
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn(false)} onClick={() => fileRef.current?.click()} disabled={busy}>
          📥 Загрузить данные (JSON)
        </button>
        <button style={dangerBtn} onClick={() => setConfirmClear(true)} disabled={busy}>
          🗑 Очистить все данные
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={onPickFile}
      />

      {status ? (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(0,230,138,0.08)',
            border: '1px solid rgba(0,230,138,0.25)',
            color: '#9ff5cf',
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {status}
        </div>
      ) : null}

      {confirmClear ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setConfirmClear(false)}
        >
          <div
            style={{ ...card, maxWidth: 340, width: '100%', marginBottom: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: '#ebebf5', marginBottom: 8 }}>
              🗑 Очистить все данные?
            </div>
            <div style={{ fontSize: 12, color: theme.textDim, lineHeight: 1.5, marginBottom: 16 }}>
              Будут удалены ВСЕ тренировки, анализы, поддержка, дневники и настройки.
              Профиль и сессия (he_profile_v2, he_session_v2) сохранятся.
              Действие можно отменить только загрузкой резервной копии.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn(false)} onClick={() => setConfirmClear(false)}>
                Отмена
              </button>
              <button style={dangerBtn} onClick={onClear}>
                Да, очистить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';

type TabId = 'wearables' | 'lab' | 'fatsecret' | 'telegram';

const LS = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* */ } },
};

const MOCK_FOODS = [
  { id: '1', name: '', calories: 165, protein: 31, fat: 3.6, carbs: 0, serving: '100 г' },
  { id: '2', name: '', calories: 92, protein: 3.4, fat: 0.6, carbs: 19.9, serving: '100 г' },
  { id: '3', name: '', calories: 155, protein: 12.6, fat: 10.6, carbs: 1.1, serving: '1 шт (60 г)' },
  { id: '4', name: '', calories: 121, protein: 17.2, fat: 5, carbs: 1.8, serving: '100 г' },
  { id: '5', name: '', calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8, serving: '1 шт (120 г)' },
  { id: '6', name: '', calories: 88, protein: 3, fat: 1.5, carbs: 15, serving: '100 г' },
  { id: '7', name: '', calories: 208, protein: 20.4, fat: 13.4, carbs: 0, serving: '100 г' },
  { id: '8', name: '', calories: 130, protein: 2.7, fat: 0.3, carbs: 28.2, serving: '100 г' },
];

const LABS = [
  { id: 'invitro', name: '', icon: '' },
  { id: 'helix', name: '', icon: '' },
  { id: 'cmd', name: 'CMD', icon: '' },
  { id: 'medsi', name: '', icon: '' },
  { id: 'gemotest', name: '', icon: '' },
];

const DEVICES = [
  { id: 'polar_h10', brand: 'Polar', model: 'H10', icon: '❤️' },
  { id: 'polar_vantage', brand: 'Polar', model: 'Vantage', icon: '⌚' },
  { id: 'garmin_forerunner', brand: 'Garmin', model: 'Forerunner', icon: '' },
  { id: 'garmin_fenix', brand: 'Garmin', model: 'Fenix', icon: '' },
  { id: 'apple_watch', brand: 'Apple', model: 'Watch', icon: '' },
];

const DAYS = ['', '', '', '', '', '', ''] as const;

function loadJson<T>(key: string, fallback: T): T {
  const raw = LS.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export const IntegrationsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('fatsecret');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'fatsecret', label: 'FatSecret', icon: '' },
    { id: 'lab', label: 'Анализы', icon: '' },
    { id: 'wearables', label: 'Носимые', icon: '⌚' },
    { id: 'telegram', label: 'Telegram', icon: '✈️' },
  ];

  return (
    <div className="screen integrations">
      <h2>Интеграции</h2>
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              flex: '1 0 auto',
              padding: '8px 12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 400,
              cursor: 'pointer',
              background: activeTab === t.id ? 'var(--accent)' : 'var(--card-bg)',
              color: activeTab === t.id ? '#0a0a0f' : 'var(--text-dim)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'fatsecret' && <FatSecretTab />}
      {activeTab === 'lab' && <LabTab />}
      {activeTab === 'wearables' && <WearablesTab />}
      {activeTab === 'telegram' && <TelegramTab />}
    </div>
  );
};

const FatSecretTab: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => LS.get('he_fatsecret_api_key') ?? '');
  const [connected, setConnected] = useState(() => LS.get('he_fatsecret_token') !== null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<typeof MOCK_FOODS>([]);
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadJson<string[]>('he_fatsecret_recent', [])
  );

  const handleConnect = () => {
    if (!apiKey.trim()) return;
    LS.set('he_fatsecret_api_key', apiKey.trim());
    LS.set('he_fatsecret_token', 'mock_token_' + Date.now());
    setConnected(true);
  };

  const handleDisconnect = () => {
    LS.del('he_fatsecret_token');
    LS.del('he_fatsecret_api_key');
    setConnected(false);
    setApiKey('');
    setSearchResults([]);
  };

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const q = searchQuery.trim().toLowerCase();
    setTimeout(() => {
      const results = MOCK_FOODS.filter(f =>
        f.name.toLowerCase().includes(q) || q.split('').some(ch => f.name.toLowerCase().includes(ch))
      );
      if (results.length === 0) {
        setSearchResults(MOCK_FOODS.slice(0, 3));
      } else {
        setSearchResults(results);
      }
      const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 10);
      setRecentSearches(updated);
      LS.set('he_fatsecret_recent', JSON.stringify(updated));
      setSearching(false);
    }, 600);
  }, [searchQuery, recentSearches]);

  const clearRecent = () => {
    setRecentSearches([]);
    LS.del('he_fatsecret_recent');
  };

  return (
    <div>
      <div className="card">
        <h3>🔑 API-ключ FatSecret</h3>
        {!connected ? (
          <div>
            <input
              type="password"
              placeholder=""
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <button className="btn" onClick={handleConnect} disabled={!apiKey.trim()}>
              Подключить
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', display: 'inline-block',
              }} />
              <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>Подключено</span>
            </div>
            <button className="btn secondary" onClick={handleDisconnect}>
              Отключить
            </button>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
          API подключение требует серверного компонента
        </p>
      </div>

      {connected && (
        <div className="card">
          <h3>🔍 Поиск продуктов</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder=""
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ marginBottom: 0 }}
            />
            <button
              className="btn"
              style={{ width: 'auto', margin: 0, padding: '13px 20px', flexShrink: 0 }}
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? '...' : ''}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {searchResults.map(food => (
                <div key={food.id} style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  marginBottom: 8,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{food.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                    {food.serving} • {food.calories} ккал
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ color: 'var(--info)' }}>Б {food.protein}г</span>
                    <span style={{ color: 'var(--warning)' }}>Ж {food.fat}г</span>
                    <span style={{ color: 'var(--accent)' }}>У {food.carbs}г</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {connected && recentSearches.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>🕐 Недавние запросы</h3>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}
              onClick={clearRecent}
            >
              Очистить
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recentSearches.map(s => (
              <span key={s} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '4px 12px',
                fontSize: 13,
                color: 'var(--text-light)',
                cursor: 'pointer',
              }} onClick={() => { setSearchQuery(s); }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const LabTab: React.FC = () => {
  const [connections, setConnections] = useState<Record<string, { connected: boolean; lastSync: string | null }>>(() =>
    loadJson<Record<string, { connected: boolean; lastSync: string | null }>>('he_lab_connections',
      Object.fromEntries(LABS.map(l => [l.id, { connected: false, lastSync: null }])))
  );
  const [importing, setImporting] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const handleConnect = (labId: string) => {
    const updated = {
      ...connections,
      [labId]: { connected: true, lastSync: new Date().toISOString() },
    };
    setConnections(updated);
    LS.set('he_lab_connections', JSON.stringify(updated));
  };

  const handleDisconnect = (labId: string) => {
    const updated = {
      ...connections,
      [labId]: { connected: false, lastSync: null },
    };
    setConnections(updated);
    LS.set('he_lab_connections', JSON.stringify(updated));
  };

  const handleImport = (labId: string) => {
    setImporting(labId);
    setImportMsg(null);
    setTimeout(() => {
      const updated = {
        ...connections,
        [labId]: { ...connections[labId], lastSync: new Date().toISOString() },
      };
      setConnections(updated);
      LS.set('he_lab_connections', JSON.stringify(updated));
      setImporting(null);
      setImportMsg(`${LABS.find(l => l.id === labId)?.name}: данные импортированы`);
      setTimeout(() => setImportMsg(null), 3000);
    }, 1500);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {importMsg && (
        <div style={{
          background: 'var(--success-dim)',
          border: '1px solid var(--success)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          marginBottom: 12,
          fontSize: 13,
          color: 'var(--success)',
          fontWeight: 500,
        }}>
          ✓ {importMsg}
        </div>
      )}

      {LABS.map(lab => {
        const conn = connections[lab.id] ?? { connected: false, lastSync: null };
        return (
          <div key={lab.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{lab.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{lab.name}</div>
                  {conn.lastSync && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      Посл. синхр.: {formatDate(conn.lastSync)}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: conn.connected ? 'var(--success)' : 'var(--text-dim)',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, color: conn.connected ? 'var(--success)' : 'var(--text-dim)', fontWeight: 500 }}>
                  {conn.connected ? '' : ''}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {!conn.connected ? (
                <button className="btn" style={{ margin: 0 }} onClick={() => handleConnect(lab.id)}>
                  Подключить
                </button>
              ) : (
                <>
                  <button
                    className="btn"
                    style={{ margin: 0, background: 'var(--info)', flex: 1 }}
                    onClick={() => handleImport(lab.id)}
                    disabled={importing === lab.id}
                  >
                    {importing === lab.id ? '' : ''}
                  </button>
                  <button
                    className="btn secondary"
                    style={{ margin: 0, width: 'auto', flexShrink: 0 }}
                    onClick={() => handleDisconnect(lab.id)}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const WearablesTab: React.FC = () => {
  const [connections, setConnections] = useState<Record<string, {
    connected: boolean;
    lastSync: string | null;
    data?: { hrRest: number; hrv: number; steps: number; calories: number; sleepPhases: string };
  }>>(() =>
    loadJson<Record<string, { connected: boolean; lastSync: string | null; data?: { hrRest: number; hrv: number; steps: number; calories: number; sleepPhases: string } }>>(
      'he_wearable_connections',
      Object.fromEntries(DEVICES.map(d => [d.id, { connected: false, lastSync: null }]))
    )
  );
  const [bluetoothMsg, setBluetoothMsg] = useState<string | null>(null);

  const handleConnect = (deviceId: string) => {
    const hasBt = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    if (!hasBt) {
      setBluetoothMsg('Web Bluetooth не поддерживается в этом браузере. Используйте мобильное приложение для подключения устройств.');
      setTimeout(() => setBluetoothMsg(null), 4000);
    } else {
      setBluetoothMsg('');
      setTimeout(() => setBluetoothMsg(null), 2000);
    }

    setTimeout(() => {
      const mockData = {
        hrRest: 62 + Math.floor(Math.random() * 12),
        hrv: 45 + Math.floor(Math.random() * 20),
        steps: 5000 + Math.floor(Math.random() * 8000),
        calories: 1800 + Math.floor(Math.random() * 600),
        sleepPhases: '',
      };
      const updated = {
        ...connections,
        [deviceId]: {
          connected: true,
          lastSync: new Date().toISOString(),
          data: mockData,
        },
      };
      setConnections(updated);
      LS.set('he_wearable_connections', JSON.stringify(updated));
    }, 1200);
  };

  const handleDisconnect = (deviceId: string) => {
    const updated = {
      ...connections,
      [deviceId]: { connected: false, lastSync: null },
    };
    setConnections(updated);
    LS.set('he_wearable_connections', JSON.stringify(updated));
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {bluetoothMsg && (
        <div style={{
          background: 'var(--info-dim)',
          border: '1px solid var(--info)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          marginBottom: 12,
          fontSize: 12,
          color: 'var(--info)',
        }}>
          {bluetoothMsg}
        </div>
      )}

      {DEVICES.map(device => {
        const conn = connections[device.id] ?? { connected: false, lastSync: null };
        return (
          <div key={device.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{device.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{device.brand} {device.model}</div>
                  {conn.lastSync && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      Синхр.: {formatDate(conn.lastSync)}
                    </div>
                  )}
                </div>
              </div>
              {!conn.connected ? (
                <button className="btn" style={{ margin: 0, padding: '8px 16px', fontSize: 13 }} onClick={() => handleConnect(device.id)}>
                  Подключить
                </button>
              ) : (
                <button className="btn secondary" style={{ margin: 0, padding: '8px 16px', fontSize: 13, color: 'var(--danger)' }} onClick={() => handleDisconnect(device.id)}>
                  Отключить
                </button>
              )}
            </div>

            {conn.connected && conn.data && (
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Синхронизированные данные</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Покой: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{conn.data.hrRest} уд/мин</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>HRV: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{conn.data.hrv} мс</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Шаги: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{conn.data.steps.toLocaleString()}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Калории: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{conn.data.calories}</span></div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                  Сон: <span style={{ color: 'var(--text)' }}>{conn.data.sleepPhases}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const TelegramTab: React.FC = () => {
  const [botToken, setBotToken] = useState(() => LS.get('he_telegram_bot_token') ?? '');
  const [chatId, setChatId] = useState(() => LS.get('he_telegram_chat_id') ?? '');
  const [connected, setConnected] = useState(() => LS.get('he_telegram_connected') === 'true');
  const [checkupDay, setCheckupDay] = useState<number>(() =>
    Number(LS.get('he_telegram_checkup_day') ?? '0')
  );
  const [checkupTime, setCheckupTime] = useState(() =>
    LS.get('he_telegram_checkup_time') ?? '09:00'
  );
  const [notifications, setNotifications] = useState<{ articles: boolean; checkups: boolean; reports: boolean }>(() =>
    loadJson('he_telegram_notifications', { articles: true, checkups: true, reports: true })
  );
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const save = (key: string, val: string) => LS.set(key, val);

  const handleConnect = () => {
    if (!botToken.trim()) return;
    save('he_telegram_bot_token', botToken.trim());
    const generated = Math.abs(Math.round(Math.random() * 1e12)).toString();
    setChatId(generated);
    save('he_telegram_chat_id', generated);
    save('he_telegram_connected', 'true');
    setConnected(true);
  };

  const handleDisconnect = () => {
    LS.del('he_telegram_bot_token');
    LS.del('he_telegram_chat_id');
    LS.del('he_telegram_connected');
    setConnected(false);
    setBotToken('');
    setChatId('');
  };

  const handleTest = () => {
    if (!connected) return;
    setTesting(true);
    setTestMsg(null);
    setTimeout(() => {
      setTesting(false);
      setTestMsg('');
      setTimeout(() => setTestMsg(null), 3000);
    }, 1000);
  };

  const toggleNotification = (key: 'articles' | 'checkups' | 'reports') => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    LS.set('he_telegram_notifications', JSON.stringify(updated));
  };

  useEffect(() => {
    if (checkupDay !== undefined) save('he_telegram_checkup_day', String(checkupDay));
  }, [checkupDay]);

  useEffect(() => {
    save('he_telegram_checkup_time', checkupTime);
  }, [checkupTime]);

  const botLink = connected ? 'https://t.me/health_engine_bot' : null;

  return (
    <div>
      <div className="card">
        <h3>🤖 Настройка бота</h3>
        {!connected ? (
          <div>
            <input
              type="password"
              placeholder=""
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
            />
            <button className="btn" onClick={handleConnect} disabled={!botToken.trim()}>
              Подключить бота
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>Подключено</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
              Chat ID: <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{chatId}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn secondary" style={{ margin: 0, padding: '8px 16px', fontSize: 13 }} onClick={handleDisconnect}>
                Отключить
              </button>
              <button
                className="btn"
                style={{ margin: 0, padding: '8px 16px', fontSize: 13, background: 'var(--info)' }}
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? '' : ''}
              </button>
              {botLink && (
                <a
                  href={botLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'var(--accent-dim)', color: 'var(--accent)',
                    padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  }}
                >
                  Открыть бота ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {connected && (
        <>
          <div className="card">
            <h3>📅 Время еженедельного чекапа</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={checkupDay}
                onChange={e => setCheckupDay(parseFloat(e.target.value) || 0)}
                style={{ flex: 1, marginBottom: 0 }}
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
              <input
                type="time"
                value={checkupTime}
                onChange={e => setCheckupTime(e.target.value)}
                style={{ width: 120, marginBottom: 0 }}
              />
            </div>
          </div>

          <div className="card">
            <h3>🔔 Уведомления</h3>
            {([
              { key: 'articles' as const, label: '' },
              { key: 'checkups' as const, label: '' },
              { key: 'reports' as const, label: '' },
            ]).map(item => (
              <div key={item.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 14 }}>{item.label}</span>
                <button
                  onClick={() => toggleNotification(item.key)}
                  style={{
                    width: 48, height: 26, borderRadius: 13,
                    background: notifications[item.key] ? 'var(--accent)' : 'var(--border)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3,
                    left: notifications[item.key] ? 24 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s ease',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {testMsg && (
        <div style={{
          background: 'var(--success-dim)', border: '1px solid var(--success)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px',
          fontSize: 13, color: 'var(--success)', fontWeight: 500, textAlign: 'center',
        }}>
          {testMsg}
        </div>
      )}
    </div>
  );
};
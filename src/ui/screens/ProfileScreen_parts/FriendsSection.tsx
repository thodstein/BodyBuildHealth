import React, { useState, useEffect, useCallback } from 'react';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  addedAt: string;
  status: 'active' | 'pending' | 'blocked';
  sharedReport?: string;
  viewAccess: boolean;
}

const FRIENDS_KEY = 'he_friends';
const MESSAGES_KEY = 'he_friend_messages';

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
  type: 'text' | 'report_share' | 'access_grant' | 'access_revoke';
}

function loadFriends(): Friend[] {
  try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]'); } catch { return []; }
}
function saveFriends(friends: Friend[]) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}
function loadMessages(friendId: string): Message[] {
  try { return JSON.parse(localStorage.getItem(MESSAGES_KEY + '_' + friendId) || '[]'); } catch { return []; }
}
function saveMessages(friendId: string, msgs: Message[]) {
  localStorage.setItem(MESSAGES_KEY + '_' + friendId, JSON.stringify(msgs));
}

export const FriendsSection: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [addUsername, setAddUsername] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    setFriends(loadFriends());
  }, []);

  const addFriend = useCallback(() => {
    if (!addUsername.trim()) return;
    const username = addUsername.trim().replace('@', '');
    if (friends.some(f => f.username === username)) return;
    const newFriend: Friend = {
      id: 'f_' + Date.now(),
      username,
      displayName: username,
      addedAt: new Date().toISOString(),
      status: 'pending',
      viewAccess: false,
    };
    const updated = [...friends, newFriend];
    saveFriends(updated);
    setFriends(updated);
    setAddUsername('');
    // Auto-message
    const msg: Message = {
      id: 'm_' + Date.now(),
      from: 'system',
      to: newFriend.id,
      text: `Запрос на добавление в друзья отправлен @${username}`,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    const msgs = loadMessages(newFriend.id);
    msgs.push(msg);
    saveMessages(newFriend.id, msgs);
  }, [addUsername, friends]);

  const removeFriend = useCallback((id: string) => {
    const updated = friends.filter(f => f.id !== id);
    saveFriends(updated);
    setFriends(updated);
    if (selectedFriend === id) {
      setSelectedFriend(null);
      setShowChat(false);
    }
  }, [friends, selectedFriend]);

  const toggleAccess = useCallback((id: string) => {
    const updated = friends.map(f => f.id === id ? { ...f, viewAccess: !f.viewAccess } : f);
    saveFriends(updated);
    setFriends(updated);
    const friend = updated.find(f => f.id === id);
    if (friend) {
      const msg: Message = {
        id: 'm_' + Date.now(),
        from: 'system',
        to: id,
        text: friend.viewAccess ? `Вы предоставили @${friend.username} доступ к просмотру ваших данных` : `Вы отозвали доступ у @${friend.username}`,
        timestamp: new Date().toISOString(),
        type: friend.viewAccess ? 'access_grant' : 'access_revoke',
      };
      const msgs = loadMessages(id);
      msgs.push(msg);
      saveMessages(id, msgs);
    }
  }, [friends]);

  const shareReport = useCallback((id: string) => {
    const friend = friends.find(f => f.id === id);
    if (!friend) return;
    const reportId = 'rpt_' + Date.now();
    const updated = friends.map(f => f.id === id ? { ...f, sharedReport: reportId } : f);
    saveFriends(updated);
    setFriends(updated);
    const msg: Message = {
      id: 'm_' + Date.now(),
      from: 'system',
      to: id,
      text: `Вы поделились отчётом с @${friend.username}`,
      timestamp: new Date().toISOString(),
      type: 'report_share',
    };
    const msgs = loadMessages(id);
    msgs.push(msg);
    saveMessages(id, msgs);
  }, [friends]);

  const openChat = useCallback((id: string) => {
    setSelectedFriend(id);
    setShowChat(true);
    setMessages(loadMessages(id));
  }, []);

  const sendMessage = useCallback(() => {
    if (!newMsg.trim() || !selectedFriend) return;
    const msg: Message = {
      id: 'm_' + Date.now(),
      from: 'me',
      to: selectedFriend,
      text: newMsg.trim(),
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    const msgs = loadMessages(selectedFriend);
    msgs.push(msg);
    saveMessages(selectedFriend, msgs);
    setMessages([...msgs]);
    setNewMsg('');
  }, [newMsg, selectedFriend]);

  const selectedFriendData = friends.find(f => f.id === selectedFriend);

  return (
    <div>
      {/* Add friend */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>👥 Друзья</h3>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.5 }}>
          Добавляйте друзей по нику в Telegram. Обменивайтесь отчётами, открывайте доступ к просмотру данных.
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={addUsername} onChange={e => setAddUsername(e.target.value)}
            placeholder="@username"
            onKeyDown={e => e.key === 'Enter' && addFriend()}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
          <button onClick={addFriend} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>+</button>
        </div>
      </div>

      {/* Friends list */}
      {friends.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13 }}>Список друзей ({friends.length})</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {friends.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: 10, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: 13 }}>
                    {f.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>@{f.username}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                      {f.status === 'pending' ? '⏳ Ожидает' : '✅ Активен'}
                      {f.viewAccess && ' • 👁 Доступ открыт'}
                      {f.sharedReport && ' • 📊 Отчёт'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => openChat(f.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 10, cursor: 'pointer' }}>💬</button>
                  <button onClick={() => shareReport(f.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 10, cursor: 'pointer' }}>📊</button>
                  <button onClick={() => toggleAccess(f.id)} style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${f.viewAccess ? '#00e68a' : 'var(--border)'}`, background: f.viewAccess ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: f.viewAccess ? '#00e68a' : 'var(--text-dim)', fontSize: 10, cursor: 'pointer' }}>👁</button>
                  <button onClick={() => removeFriend(f.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      {showChat && selectedFriendData && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 13 }}>💬 Чат с @{selectedFriendData.username}</h4>
            <button onClick={() => setShowChat(false)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)', fontSize: 10 }}>✕</button>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 8, display: 'grid', gap: 6 }}>
            {messages.map(m => (
              <div key={m.id} style={{ background: m.from === 'me' ? 'rgba(0,230,138,0.1)' : m.from === 'system' ? 'rgba(139,92,246,0.08)' : 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 8, fontSize: 11 }}>
                {m.from === 'system' && <span style={{ color: '#8b5cf6', fontSize: 9, marginRight: 4 }}>Система</span>}
                {m.from === 'me' && <span style={{ color: '#00e68a', fontSize: 9, marginRight: 4 }}>Вы</span>}
                <span style={{ color: m.type === 'report_share' ? '#f59e0b' : m.type === 'access_grant' ? '#22c55e' : 'var(--text-dim)' }}>{m.text}</span>
                <div style={{ fontSize: 8, color: 'var(--text-dim)', marginTop: 2 }}>{new Date(m.timestamp).toLocaleString('ru-RU')}</div>
              </div>
            ))}
            {messages.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>Нет сообщений</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Сообщение..."
              style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' }} />
            <button onClick={sendMessage} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#000', fontWeight: 600, fontSize: 12 }}>➤</button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>ℹ️ О функционале</h4>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          <div>• <b>Добавление друзей</b> — по нику в Telegram</div>
          <div>• <b>Чат</b> — личные сообщения между друзьями</div>
          <div>• <b>Поделиться отчётом</b> — отправить отчёт о рисках/анализах другу</div>
          <div>• <b>Доступ к просмотру</b> — разрешить другу просматривать ваши данные</div>
          <div>• <b>Telegram Mini App</b> — для реальной отправки используется Telegram Bot API</div>
        </div>
      </div>
    </div>
  );
};

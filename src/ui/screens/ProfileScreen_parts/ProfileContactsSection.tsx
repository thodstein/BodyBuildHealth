import React, { useRef } from 'react';
import type { UserProfile } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle } from './ProfileComponents';

interface Props {
  settings: UserProfile['settings'];
  profileName: string;
  onNavigate?: (screen: string) => void;
}

interface TelegramFriend { id: string; name: string; username: string; avatar?: string; addedAt: string; }
const TELEGRAM_FRIENDS_KEY = 'telegramFriends';
const getFriends = (): TelegramFriend[] => {
  try { return JSON.parse(localStorage.getItem(TELEGRAM_FRIENDS_KEY) || '[]'); } catch { return []; }
};

export const ProfileContactsSection: React.FC<Props> = ({ settings, profileName, onNavigate }) => {
  const [showFriendForm, setShowFriendForm] = React.useState(false);
  const [friendName, setFriendName] = React.useState('');
  const [friendUsername, setFriendUsername] = React.useState('');
  const [friendVerifyStatus, setFriendVerifyStatus] = React.useState<'idle'|'checking'|'found'|'not_found'>('idle');
  const [friendVerifiedName, setFriendVerifiedName] = React.useState('');
  const [showTrainingForm, setShowTrainingForm] = React.useState(false);
  const [trainingUsername, setTrainingUsername] = React.useState('');
  const [notification, setNotification] = React.useState<{text:string;type:'success'|'error'} | null>(null);
  const [friends, setFriends] = React.useState<TelegramFriend[]>(getFriends);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showNotif = (text: string, type: 'success'|'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 2500);
  };

  const saveFriends = (f: TelegramFriend[]) => {
    localStorage.setItem(TELEGRAM_FRIENDS_KEY, JSON.stringify(f));
    setFriends(f);
  };
  const removeFriend = (id: string) => { saveFriends(friends.filter(f => f.id !== id)); showNotif('Друг удалён'); };
  const onFriendUsernameChange = (val: string) => {
    setFriendUsername(val);
    setFriendVerifyStatus('idle');
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    if (val.trim().length >= 3) {
      verifyTimerRef.current = setTimeout(async () => {
        const u = val.trim().replace(/^@/, '');
        if (!u) return;
        setFriendVerifyStatus('checking');
        try {
          const res = await fetch('/api/verify-telegram-user', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u }),
          });
          const data = await res.json();
          if (data.ok) {
            setFriendVerifyStatus('found');
            setFriendVerifiedName(data.name || u);
            if (!friendName.trim()) setFriendName(data.name || u);
          } else { setFriendVerifyStatus('not_found'); }
        } catch { setFriendVerifyStatus('not_found'); }
      }, 600);
    }
  };

  const doAddFriend = () => {
    if (!friendName.trim()) return;
    const newFriend: TelegramFriend = {
      id: crypto.randomUUID(), name: friendName.trim(),
      username: friendUsername.trim().replace(/^@/, '') || 'user',
      addedAt: new Date().toISOString().split('T')[0],
    };
    saveFriends([...friends, newFriend]);
    setFriendName(''); setFriendUsername(''); setFriendVerifyStatus('idle'); setShowFriendForm(false);
    showNotif(`✅ ${newFriend.name} добавлен${friendVerifyStatus === 'found' ? ' (подтверждён через Telegram)' : ''}`);
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.switchInlineQuery) { setTimeout(() => { try { tg.switchInlineQuery(`friend_${newFriend.id}`, ['users']); } catch {} }, 500); }
  };

  const doInviteFriend = () => {
    const inviteLink = `https://t.me/BodyBuildHealthBot?start=ref_${crypto.randomUUID().slice(0, 8)}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) { tg.openTelegramLink(inviteLink); showNotif('🔗 Приглашение отправлено'); }
    else { navigator.clipboard?.writeText(inviteLink).then(() => showNotif('📋 Ссылка-приглашение скопирована')); }
  };

  const doShareReport = () => {
    const tg = (window as any).Telegram?.WebApp;
    const bmiVal = settings.weight && settings.height ? (settings.weight / Math.pow(settings.height / 100, 2)).toFixed(1) : '—';
    const pw = (settings as any).personal;
    const lbm = pw?.weight && pw?.bodyFat ? pw.weight * (1 - pw.bodyFat / 100) : 0;
    const ffmiVal = lbm && settings.height ? (lbm / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : '—';
    const riskRaw = (() => { try { return JSON.parse(localStorage.getItem('he_last_risk') || 'null'); } catch { return null; } })();
    const riskPct = riskRaw?.overallNet || '—';
    const supps = (settings.currentSupplements || []).slice(0, 3).map((x: any) => x.name).join(', ') || 'нет';
    const report = [
      '📊 *Отчёт BodyBuildHealth*', `👤 ${profileName || 'Пользователь'}`,
      `⚖️ Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см`,
      `📐 BMI: ${bmiVal} | FFMI: ${ffmiVal}`, `🔥 Риск: ${riskPct}%`,
      `💊 Поддержка: ${supps}`, `📅 ${new Date().toLocaleDateString('ru')}`,
    ].join('\n');
    if (tg?.sendData) { tg.sendData(JSON.stringify({ type: 'share_report', report })); showNotif('📤 Отчёт отправлен через Telegram'); }
    else if (tg?.openTelegramLink) { tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent('https://body-build-health.vercel.app')}&text=${encodeURIComponent(report)}`); showNotif('🔗 Telegram открыт'); }
    else { navigator.clipboard?.writeText(report).then(() => showNotif('📋 Отчёт скопирован в буфер')); }
  };

  const doShareTraining = () => {
    if (!trainingUsername.trim()) return;
    const tg = (window as any).Telegram?.WebApp;
    const deepLink = `https://t.me/BodyBuildHealthBot?start=training_view_${trainingUsername.trim()}`;
    localStorage.setItem('he_shared_training_for', trainingUsername.trim());
    if (tg?.openTelegramLink) { tg.openTelegramLink(deepLink); }
    else if (tg?.openLink) { tg.openLink(deepLink); }
    else { navigator.clipboard?.writeText(deepLink).then(() => showNotif('📋 Ссылка скопирована')); }
    setTrainingUsername(''); setShowTrainingForm(false);
  };

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)',
    background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box',
  };

  return (
    <div>
      <div style={glassCardStyle}>
        <div style={sectionLabelStyle}>Контакты и друзья</div>
        <p style={{ fontSize:10, color: theme.textDim, margin:'4px 0 10px' }}>
          Управление списком друзей, обмен отчётами и доступ к тренировкам.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
          <button onClick={() => setShowFriendForm(true)}
            style={{ padding:'10px 8px', borderRadius:14, cursor:'pointer', border:'none', color:'#fff', fontWeight:700, fontSize:12, background: theme.gradientBlue }}>
            ➕ Добавить друга</button>
          <button onClick={doShareReport}
            style={{ padding:'10px 8px', borderRadius:14, cursor:'pointer', border:'none', color:'#000', fontWeight:700, fontSize:12, background: theme.gradientOrange }}>
            📤 Поделиться отчётом</button>
        </div>
        <button onClick={() => setShowTrainingForm(true)}
          style={{ width:'100%', padding:'10px 8px', borderRadius:14, cursor:'pointer', marginBottom:10, background: theme.gradientPurple, border:'none', color:'#fff', fontWeight:700, fontSize:12 }}>
          🏋️ Открыть тренировку другу</button>
        <button onClick={() => {
          const tg = (window as any).Telegram?.WebApp;
          if (tg?.openTelegramLink) tg.openTelegramLink('https://t.me/BodyBuildHealthBot');
          else if (tg?.openLink) tg.openLink('https://t.me/BodyBuildHealthBot');
          else window.open('https://t.me/BodyBuildHealthBot', '_blank');
          showNotif('🔗 Открываю Telegram...');
        }}
          style={{ width:'100%', padding:'10px 8px', borderRadius:14, cursor:'pointer', marginBottom:10, background: theme.gradientGreen, border:'none', color:'#000', fontWeight:700, fontSize:12 }}>
          💬 Связаться с поддержкой</button>
      </div>

      {/* Friend form modal */}
      {showFriendForm && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:20 }}
          onClick={() => setShowFriendForm(false)}>
          <div style={{ background:'#18181b', borderRadius:16, padding:20, maxWidth:340, width:'100%', border:'1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#fff' }}>➕ Добавить друга</h3>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.6)', margin:'0 0 12px' }}>
              Добавьте друга в локальный список. После сохранения через Telegram откроется выбор чата — отправьте другу приглашение.
            </p>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:9, color: theme.textDim, marginBottom:3 }}>Имя *</div>
              <input type="text" value={friendName} onChange={e => setFriendName(e.target.value)} placeholder="Алексей" style={inputStyle} />
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9, color: theme.textDim, marginBottom:3 }}>Username Telegram (без @)</div>
              <div style={{ position:'relative' }}>
                <input type="text" value={friendUsername} onChange={e => onFriendUsernameChange(e.target.value)} placeholder="alex_fit" style={inputStyle} />
                {friendVerifyStatus === 'checking' && <span style={{ position:'absolute', right:10, top:10, fontSize:10, color:'#f59e0b' }}>⏳</span>}
              </div>
              {friendVerifyStatus === 'found' && <div style={{ fontSize:8, color:'#22c55e', marginTop:3 }}>✅ Найден: {friendVerifiedName}</div>}
              {friendVerifyStatus === 'not_found' && <div style={{ fontSize:8, color:'#ef4444', marginTop:3 }}>❌ Пользователь не найден.</div>}
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <button onClick={doAddFriend}
                style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', background: friendName.trim() ? theme.gradientGreen : 'rgba(255,255,255,0.06)', color: friendName.trim() ? '#000' : 'rgba(255,255,255,0.4)', fontWeight:700, fontSize:12 }}>
                💾 Сохранить</button>
              <button onClick={doInviteFriend}
                style={{ padding:'10px 12px', borderRadius:10, cursor:'pointer', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', color:'#60a5fa', fontWeight:600, fontSize:12, whiteSpace:'nowrap' }}>
                🔗 Пригласить</button>
              <button onClick={() => setShowFriendForm(false)}
                style={{ padding:'10px 16px', borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.8)', fontWeight:600, fontSize:12 }}>
                Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Share training modal */}
      {showTrainingForm && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:20 }}
          onClick={() => setShowTrainingForm(false)}>
          <div style={{ background:'#18181b', borderRadius:16, padding:20, maxWidth:340, width:'100%', border:'1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#fff' }}>🏋️ Открыть тренировку другу</h3>
            <p style={{ fontSize:9, color:'rgba(255,255,255,0.6)', margin:'0 0 12px' }}>
              Создайте ссылку-приглашение, чтобы друг мог просмотреть вашу текущую программу тренировок.
            </p>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9, color: theme.textDim, marginBottom:3 }}>Username друга (без @)</div>
              <input type="text" value={trainingUsername} onChange={e => setTrainingUsername(e.target.value)} placeholder="alex_fit" style={inputStyle} />
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:3 }}>Бот создаст ссылку и откроет Telegram для отправки другу.</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={doShareTraining}
                style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', background: trainingUsername.trim() ? theme.gradientPurple : 'rgba(255,255,255,0.06)', color: trainingUsername.trim() ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight:700, fontSize:12 }}>
                🔗 Открыть доступ</button>
              <button onClick={() => setShowTrainingForm(false)}
                style={{ padding:'10px 16px', borderRadius:10, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.8)', fontWeight:600, fontSize:12 }}>
                Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Friends list */}
      <div style={glassCardStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={sectionLabelStyle}>👥 Друзья ({friends.length})</div>
        </div>
        {friends.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {friends.map(f => (
              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:14, background: theme.glassBg, border: theme.glassBorder }}>
                <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background: theme.gradientBlue, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff', fontWeight:700 }}>
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color: theme.textPrimary }}>{f.name}</div>
                  <div style={{ fontSize:9, color: theme.textDim }}>@{f.username} · {f.addedAt}</div>
                </div>
                <button onClick={() => removeFriend(f.id)}
                  style={{ padding:'4px 10px', borderRadius:8, fontSize:10, cursor:'pointer', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', fontWeight:600 }}>
                  ✕</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'14px 0', color: theme.textDim, fontSize:10 }}>
            Нет добавленных друзей. Нажмите «➕ Добавить друга» чтобы начать.
          </div>
        )}
      </div>

      {/* Toast notification */}
      {notification && (
        <div style={{
          position:'fixed', bottom:30, left:'50%', transform:'translateX(-50%)', zIndex:2000,
          padding:'10px 20px', borderRadius:12,
          background: notification.type === 'success' ? 'rgba(0,230,138,0.15)' : 'rgba(239,68,68,0.15)',
          border: notification.type === 'success' ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(239,68,68,0.3)',
          color: notification.type === 'success' ? '#00e68a' : '#ef4444',
          fontSize:12, fontWeight:600, textAlign:'center',
          boxShadow:'0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {notification.text}
        </div>
      )}
    </div>
  );
};

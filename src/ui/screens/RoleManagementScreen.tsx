import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../core/db';

type Role = 'user' | 'coach' | 'doctor' | 'author' | 'editor' | 'admin';
type Status = 'active' | 'inactive' | 'pending';

interface HeUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: Status;
  lastLogin: string | null;
  notes: string;
  consentCoach: boolean;
  consentDoctor: boolean;
}

interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

const LS_USERS = 'he_users';
const LS_LOG = 'he_audit_log';
const LS_CURRENT = 'he_current_user_id';

const DEFAULT_USERS: HeUser[] = [
  {
    id: 'admin-001',
    email: 'admin@healthengine.ru',
    fullName: '',
    role: 'admin',
    status: 'active',
    lastLogin: new Date().toISOString(),
    notes: '',
    consentCoach: false,
    consentDoctor: false,
  },
];

const ROLE_LABELS: Record<Role, string> = {
  user: '',
  coach: '',
  doctor: '',
  author: '',
  editor: '',
  admin: '',
};

const STATUS_LABELS: Record<Status, string> = {
  active: '',
  inactive: '',
  pending: '',
};

const PERMISSIONS: Record<Role, string[]> = {
  user: ['', '', '', '', ''],
  coach: ['', '', ''],
  doctor: ['', '', ''],
  author: [''],
  editor: ['', ''],
  admin: ['', '', ''],
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function loadUsers(): HeUser[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  localStorage.setItem(LS_USERS, JSON.stringify(DEFAULT_USERS));
  return [...DEFAULT_USERS];
}

function saveUsers(users: HeUser[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function loadLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(LS_LOG);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function appendLog(actor: string, action: string, detail: string) {
  const log = loadLog();
  log.unshift({ timestamp: new Date().toISOString(), actor, action, detail });
  localStorage.setItem(LS_LOG, JSON.stringify(log));
}

function getCurrentUserId(): string {
  return localStorage.getItem(LS_CURRENT) || 'admin-001';
}

export const RoleManagementScreen: React.FC = () => {
  const [users, setUsers] = useState<HeUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<HeUser | null>(null);
  const [tab, setTab] = useState<'users' | 'permissions' | 'log'>('users');
  const [addForm, setAddForm] = useState({ fullName: '', email: '', role: 'user' as Role });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    const loaded = loadUsers();
    setUsers(loaded);
    setAuditLog(loadLog());
    db.init().catch(() => {});
  }, []);

  const persistUsers = useCallback((next: HeUser[]) => {
    setUsers(next);
    saveUsers(next);
  }, []);

  const handleAddUser = () => {
    if (!addForm.fullName.trim() || !addForm.email.trim()) return;
    const newUser: HeUser = {
      id: generateId(),
      email: addForm.email.trim(),
      fullName: addForm.fullName.trim(),
      role: addForm.role,
      status: 'active',
      lastLogin: null,
      notes: '',
      consentCoach: false,
      consentDoctor: false,
    };
    const next = [...users, newUser];
    persistUsers(next);
    appendLog(getCurrentUserId(), 'ADD_USER', ``);
    setAuditLog(loadLog());
    setAddForm({ fullName: '', email: '', role: 'user' });
    setShowAddForm(false);
    db.put('users', newUser).catch(() => {});
  };

  const handleRoleChange = (userId: string, newRole: Role) => {
    const next = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    appendLog(getCurrentUserId(), 'ROLE_CHANGE', `${target?.fullName}: СЂРѕР»СЊ в†’ ${ROLE_LABELS[newRole]}`);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(target || null);
  };

  const handleStatusChange = (userId: string, newStatus: Status) => {
    const next = users.map(u => u.id === userId ? { ...u, status: newStatus } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    appendLog(getCurrentUserId(), 'STATUS_CHANGE', `${target?.fullName}: СЃС‚Р°С‚СѓСЃ в†’ ${STATUS_LABELS[newStatus]}`);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(target || null);
    db.put('users', target!).catch(() => {});
  };

  const handleConsentChange = (userId: string, field: 'consentCoach' | 'consentDoctor', value: boolean) => {
    const next = users.map(u => u.id === userId ? { ...u, [field]: value } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    const label = field === 'consentCoach' ? 'С‚СЂРµРЅРµСЂСѓ' : '';
    appendLog(getCurrentUserId(), 'CONSENT_CHANGE', `${target?.fullName}: РґРѕСЃС‚СѓРї ${label} в†’ ${value ? 'СЂР°Р·СЂРµС€С‘РЅ' : ''}`);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(target || null);
    db.put('users', target!).catch(() => {});
  };

  const handleSaveNotes = (userId: string) => {
    const next = users.map(u => u.id === userId ? { ...u, notes: editNotes } : u);
    persistUsers(next);
    const target = next.find(u => u.id === userId);
    if (selectedUser?.id === userId) setSelectedUser(target || null);
    db.put('users', target!).catch(() => {});
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === getCurrentUserId()) return;
    const target = users.find(u => u.id === userId);
    const next = users.filter(u => u.id !== userId);
    persistUsers(next);
    appendLog(getCurrentUserId(), 'DELETE_USER', ``);
    setAuditLog(loadLog());
    if (selectedUser?.id === userId) setSelectedUser(null);
    db.delete('users', userId).catch(() => {});
  };

  const openEdit = (user: HeUser) => {
    setSelectedUser(user);
    setEditNotes(user.notes);
  };

  const currentUserId = getCurrentUserId();

  return (
    <div className="screen role-management">
      <div className="role-management-header">
        <h2>РЈРїСЂР°РІР»РµРЅРёРµ СЂРѕР»СЏРјРё Рё РїСЂР°РІР°РјРё РґРѕСЃС‚СѓРїР°</h2>
        <p>РќР°СЃС‚СЂРѕР№РєР° СЂРѕР»РµР№ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ Рё РёС… РїСЂР°РІ РґРѕСЃС‚СѓРїР° Рє С„СѓРЅРєС†РёРѕРЅР°Р»Сѓ СЃРёСЃС‚РµРјС‹</p>
        <div className="role-management-actions">
          <button className="btn" onClick={() => { setShowAddForm(true); setSelectedUser(null); }}>
            Р”РѕР±Р°РІРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
          </button>
        </div>
      </div>

      <div className="role-management-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>РџРѕР»СЊР·РѕРІР°С‚РµР»Рё</button>
        <button className={tab === 'permissions' ? 'active' : ''} onClick={() => setTab('permissions')}>Р РѕР»Рё Рё СЂР°Р·СЂРµС€РµРЅРёСЏ</button>
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Р–СѓСЂРЅР°Р» РґРµР№СЃС‚РІРёР№</button>
      </div>

      {showAddForm && (
        <div className="add-user-form">
          <h3>РќРѕРІС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ</h3>
          <div className="form-row">
            <label>Р¤РРћ<input value={addForm.fullName} onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))} /></label>
            <label>Email<input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></label>
            <label>Р РѕР»СЊ
              <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value as Role }))}>
                {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn" onClick={handleAddUser}>Р”РѕР±Р°РІРёС‚СЊ</button>
            <button className="btn secondary" onClick={() => setShowAddForm(false)}>РћС‚РјРµРЅР°</button>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="user-details-panel">
          <h3>Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ: {selectedUser.fullName}</h3>
          <div className="user-info">
            <p><strong>Email:</strong> {selectedUser.email}</p>
            <p><strong>Р¤РРћ:</strong> {selectedUser.fullName}</p>
            <p><strong>РџРѕСЃР»РµРґРЅРёР№ РІС…РѕРґ:</strong> {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : ''}</p>
          </div>

          <div className="role-editor">
            <h4>Р РѕР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</h4>
            <div className="role-options">
              {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                <label key={r}>
                  <input type="radio" name="role" checked={selectedUser.role === r} onChange={() => handleRoleChange(selectedUser.id, r)} />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </div>

          <div className="status-editor">
            <h4>РЎС‚Р°С‚СѓСЃ СѓС‡С‘С‚РЅРѕР№ Р·Р°РїРёСЃРё</h4>
            <div className="status-options">
              {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
                <label key={s}>
                  <input type="radio" name="status" checked={selectedUser.status === s} onChange={() => handleStatusChange(selectedUser.id, s)} />
                  {STATUS_LABELS[s]}
                </label>
              ))}
            </div>
          </div>

          <div className="consent-editor">
            <h4>РЎРѕРіР»Р°СЃРёСЏ РЅР° РґРѕСЃС‚СѓРї</h4>
            <label className="toggle-row">
              <input type="checkbox" checked={selectedUser.consentCoach} onChange={e => handleConsentChange(selectedUser.id, 'consentCoach', e.target.checked)} />
              Р Р°Р·СЂРµС€РёС‚СЊ РґРѕСЃС‚СѓРї С‚СЂРµРЅРµСЂСѓ
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={selectedUser.consentDoctor} onChange={e => handleConsentChange(selectedUser.id, 'consentDoctor', e.target.checked)} />
              Р Р°Р·СЂРµС€РёС‚СЊ РґРѕСЃС‚СѓРї РІСЂР°С‡Сѓ
            </label>
          </div>

          <div className="notes-editor">
            <h4>Р—Р°РјРµС‚РєРё</h4>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
            <button className="btn secondary" onClick={() => handleSaveNotes(selectedUser.id)}>РЎРѕС…СЂР°РЅРёС‚СЊ Р·Р°РјРµС‚РєРё</button>
          </div>

          <div className="user-actions">
            {selectedUser.id !== currentUserId && (
              <button className="btn danger" onClick={() => handleDeleteUser(selectedUser.id)}>РЈРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</button>
            )}
            <button className="btn secondary" onClick={() => setSelectedUser(null)}>Р—Р°РєСЂС‹С‚СЊ</button>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="users-list">
          <div className="users-table-header">
            <div>Email</div>
            <div>Р¤РРћ</div>
            <div>Р РѕР»СЊ</div>
            <div>РЎС‚Р°С‚СѓСЃ</div>
            <div>Р”РѕСЃС‚СѓРї</div>
            <div>Р”РµР№СЃС‚РІРёСЏ</div>
          </div>
          <div className="users-table-body">
            {users.map(user => (
              <div key={user.id} className="user-row" onClick={() => openEdit(user)}>
                <div className="user-email">{user.email}</div>
                <div className="user-fullname">{user.fullName}</div>
                <div className="user-role">
                  <span className={`role-badge ${user.role}`}>{ROLE_LABELS[user.role]}</span>
                </div>
                <div className="user-status">
                  <span className={`status-badge ${user.status}`}>{STATUS_LABELS[user.status]}</span>
                </div>
                <div className="user-consent">
                  {user.consentCoach && ''}
                  {user.consentDoctor && ''}
                  {!user.consentCoach && !user.consentDoctor && 'вЂ”'}
                </div>
                <div className="user-actions">
                  <button className="btn-icon" title="" onClick={e => { e.stopPropagation(); openEdit(user); }}>вњЏпёЏ</button>
                  {user.id !== currentUserId && (
                    <button className="btn-icon" title="" onClick={e => { e.stopPropagation(); handleDeleteUser(user.id); }}>рџ—‘пёЏ</button>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && <div className="empty-state"><p>РџРѕР»СЊР·РѕРІР°С‚РµР»Рё РЅРµ РЅР°Р№РґРµРЅС‹.</p></div>}
          </div>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="permissions-matrix">
          <h3>РњР°С‚СЂРёС†Р° РїСЂР°РІ РґРѕСЃС‚СѓРїР° (РўР— 21)</h3>
          <table>
            <thead>
              <tr>
                <th>Р РѕР»СЊ</th>
                <th>Р’РѕР·РјРѕР¶РЅРѕСЃС‚Рё</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Role[]).map(role => (
                <tr key={role}>
                  <td><span className={`role-badge ${role}`}>{ROLE_LABELS[role]}</span></td>
                  <td>
                    <ul>
                      {PERMISSIONS[role].map(p => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'log' && (
        <div className="audit-log">
          <h3>Р–СѓСЂРЅР°Р» РґРµР№СЃС‚РІРёР№</h3>
          {auditLog.length === 0 && <p>РќРµС‚ Р·Р°РїРёСЃРµР№.</p>}
          <table>
            <thead>
              <tr>
                <th>Р’СЂРµРјСЏ</th>
                <th>Р”РµР№СЃС‚РІРёРµ</th>
                <th>Р”РµС‚Р°Р»Рё</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry, i) => (
                <tr key={i}>
                  <td>{new Date(entry.timestamp).toLocaleString()}</td>
                  <td>{entry.action}</td>
                  <td>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
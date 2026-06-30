import React, { useState } from 'react';
import { dbService } from '../services/database';
import { useApp } from '../App';

export default function ConnectPage() {
  const { setConnected, setPage } = useApp();
  const [server, setServer] = useState('Admin-PC');
  const [database, setDatabase] = useState('TOEICVocab');
  const [port, setPort] = useState('1433');
  const [authMode, setAuthMode] = useState<'windows'|'sql'>('sql');
  const [username, setUsername] = useState('sa');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    const isSQL = authMode === 'sql';
    const cfg = {
      server: server.trim(),
      database: database.trim(),
      port: parseInt(port) > 0 ? parseInt(port) : 1433,
      user: isSQL ? username.trim() : '',
      password: isSQL ? password : '',
    };

    console.log('=== CONNECT ===', JSON.stringify({...cfg, password: cfg.password ? '***' : ''}));

    const res = await dbService.connect();
    if (res.success) {
      localStorage.setItem('db_config', JSON.stringify(cfg));
      setConnected(true);
      setPage('dashboard');
    } else {
      setError(res.error || 'Không thể kết nối.');
    }
    setLoading(false);
  };

  return (
    <div className="connect-page">
      <div className="connect-bg">
        <div className="bg-orb orb1" /><div className="bg-orb orb2" />
      </div>
      <div className="connect-card">
        <div className="connect-logo">
          <div style={{ fontSize: 56, marginBottom: 12 }}>📚</div>
          <h1>TOEIC Vocab Master</h1>
          <p>Kết nối SQL Server để bắt đầu</p>
        </div>

        <div className="connect-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Server</label>
              <input className="input" value={server}
                onChange={e => setServer(e.target.value)}
                placeholder="ADMIN-PC hoặc localhost" />
            </div>
            <div className="form-group" style={{ maxWidth: 100 }}>
              <label className="form-label">Port</label>
              <input className="input" value={port}
                onChange={e => setPort(e.target.value)}
                placeholder="1433" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Database</label>
            <input className="input" value={database}
              onChange={e => setDatabase(e.target.value)} />
          </div>

          <div className="auth-toggle">
            <button
              className={`auth-btn ${authMode === 'windows' ? 'active' : ''}`}
              onClick={() => setAuthMode('windows')}>
              🔐 Windows Auth
            </button>
            <button
              className={`auth-btn ${authMode === 'sql' ? 'active' : ''}`}
              onClick={() => setAuthMode('sql')}>
              👤 SQL Auth
            </button>
          </div>

          {authMode === 'sql' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="sa"
                  autoComplete="username" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="input" type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password" />
              </div>
            </div>
          )}

          {/* Debug info */}
          {authMode === 'sql' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: 6 }}>
              Sẽ kết nối: <code style={{ color: 'var(--accent-bright)' }}>{server},{port}</code> | User: <code style={{ color: 'var(--accent-bright)' }}>{username || '(trống)'}</code>
            </div>
          )}

          {error && (
            <div className="error-box">⚠️ {error}</div>
          )}

          <button className="btn btn-primary w-full btn-lg"
            onClick={handleConnect} disabled={loading}>
            {loading ? '⏳ Đang kết nối...' : '🚀 Kết nối & Khởi tạo DB'}
          </button>

          <div className="hint-box">
            <strong>💡 Gợi ý:</strong><br/>
            • <strong>SQL Auth:</strong> Server = <code>Admin-PC</code>, Port = <code>1433</code>, user = <code>sa</code><br/>
            • <strong>Windows Auth:</strong> Server = <code>Admin-PC</code>, Port = <code>1433</code>
          </div>
        </div>
      </div>

      <style>{`
        .connect-page { height:100vh; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
        .connect-bg { position:absolute; inset:0; pointer-events:none; }
        .bg-orb { position:absolute; border-radius:50%; filter:blur(80px); opacity:0.15; }
        .orb1 { width:600px; height:600px; background:#6366f1; top:-200px; right:-200px; }
        .orb2 { width:400px; height:400px; background:#7c3aed; bottom:-150px; left:-150px; }
        .connect-card { background:var(--bg-card); border:1px solid var(--border); border-radius:20px; padding:40px; width:500px; position:relative; z-index:1; animation:slideUp 0.4s ease; }
        .connect-logo { text-align:center; margin-bottom:28px; }
        .connect-logo h1 { font-size:22px; font-weight:700; margin-bottom:6px; }
        .connect-logo p { color:var(--text-secondary); font-size:14px; }
        .connect-form { display:flex; flex-direction:column; gap:14px; }
        .auth-toggle { display:flex; gap:8px; background:var(--bg-secondary); padding:4px; border-radius:8px; }
        .auth-btn { flex:1; padding:8px 12px; border-radius:6px; border:none; background:none; color:var(--text-secondary); font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; transition:all 0.2s; }
        .auth-btn.active { background:var(--accent); color:white; }
        .error-box { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:12px; font-size:13px; color:var(--red); }
        .hint-box { background:rgba(99,102,241,0.08); border:1px solid var(--border); border-radius:8px; padding:14px; font-size:12px; color:var(--text-secondary); line-height:1.8; }
        .hint-box code { background:var(--bg-hover); padding:2px 6px; border-radius:4px; font-family:'JetBrains Mono',monospace; color:var(--accent-bright); }
      `}</style>
    </div>
  );
}

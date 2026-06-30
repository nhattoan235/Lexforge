// src/pages/MultiplayerHub.tsx
import React, { useState, useEffect } from 'react';
import multiplayerService from '../services/multiplayer';
import { db } from '../services/database';
import { useApp } from '../App';
import TowerDefensePage from './games/TowerDefensePage';
import WhackMousePage from './games/WhackMousePage';
import CoopShooterPage from './games/CoopShooterPage';

type HubState = 'setup' | 'lobby' | 'playing';
type GameType = 'tower' | 'mouse' | 'shooter';

const GAME_INFO = {
  tower:   { name: 'Tower Defense',   icon: '🏰', minWords: 50, maxPlayers: 4,  desc: 'Xây tháp bảo vệ thành, gõ từ để tấn công quái' },
  mouse:   { name: 'Whack-a-Mouse',   icon: '🐭', minWords: 20, maxPlayers: 12, desc: 'Đập chuột đối thủ bằng cách gõ từ trên đầu họ' },
  shooter: { name: 'Co-op Shooter',   icon: '🔫', minWords: 20, maxPlayers: 5,  desc: 'Cùng nhau bắn quái, thi điểm số cao nhất' },
};

export default function MultiplayerHub() {
  const { setPage } = useApp();
  const [hubState, setHubState] = useState<HubState>('setup');
  const [serverUrl, setServerUrl] = useState('http://localhost:3001');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [gameType, setGameType] = useState<GameType>('tower');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [wordCount, setWordCount] = useState(0);
  const [words, setWords] = useState<any[]>([]);
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [gameDuration, setGameDuration] = useState(120);

  useEffect(() => {
    db.getStats().then(res => {
      if (res.success && res.data?.[0]) setWordCount(res.data[0].TotalWords);
    });
    db.getWords().then(res => {
      if (res.success) setWords(res.data || []);
    });
    const saved = localStorage.getItem('player_name');
    if (saved) setPlayerName(saved);
    const savedUrl = localStorage.getItem('server_url');
    if (savedUrl) setServerUrl(savedUrl);

    return () => { multiplayerService.disconnect(); };
  }, []);

  const handleConnect = async () => {
    if (!playerName.trim()) { setError('Nhập tên người chơi!'); return; }
    setConnecting(true); setError('');
    try {
      await multiplayerService.connect(serverUrl);
      setConnected(true);
      localStorage.setItem('player_name', playerName);
      localStorage.setItem('server_url', serverUrl);
      setupListeners();
    } catch (err: any) {
      setError(`Không kết nối được! Kiểm tra server URL.\n${err.message}`);
    }
    setConnecting(false);
  };

  const setupListeners = () => {
    const s = multiplayerService;
    s.on('room:created', ({ room }: any) => { setRoom(room); setHubState('lobby'); });
    s.on('room:joined',  ({ room }: any) => { setRoom(room); setHubState('lobby'); });
    s.on('room:updated', ({ room }: any) => setRoom({ ...room }));
    s.on('room:error',   ({ msg }: any) => setError(msg));
    s.on('game:started', ({ gameType }: any) => setActiveGame(gameType));
    s.on('game:error',   ({ msg }: any) => setError(msg));
  };

  const handleCreate = () => {
    const info = GAME_INFO[gameType];
    if (wordCount < info.minWords) {
      setError(`Game ${info.name} cần tối thiểu ${info.minWords} từ vựng! Hiện có ${wordCount} từ.`);
      return;
    }
    multiplayerService.emit('room:create', {
      gameType, playerName,
      settings: { maxPlayers: gameType === 'mouse' ? maxPlayers : GAME_INFO[gameType].maxPlayers, duration: gameDuration }
    });
  };

  const handleJoin = () => {
    if (!roomCode.trim()) { setError('Nhập mã phòng!'); return; }
    multiplayerService.emit('room:join', { roomId: roomCode.toUpperCase(), playerName });
  };

  const handleReady = () => {
    multiplayerService.emit('room:ready', { roomId: room.id });
  };

  const handleStart = () => {
    const minWords = GAME_INFO[room.gameType]?.minWords || 20;
    if (words.length < minWords) {
      setError(`Cần ít nhất ${minWords} từ vựng!`);
      return;
    }
    multiplayerService.emit('game:start', { roomId: room.id, words: words.slice(0, 200) });
  };

  const handleLeave = () => {
    if (room) multiplayerService.emit('room:leave', { roomId: room.id });
    setRoom(null); setHubState('setup'); setActiveGame(null); setError('');
  };

  // Show game
  if (activeGame && room) {
    if (activeGame === 'tower') return <TowerDefensePage room={room} words={words} onLeave={handleLeave} />;
    if (activeGame === 'mouse') return <WhackMousePage room={room} words={words} onLeave={handleLeave} />;
    if (activeGame === 'shooter') return <CoopShooterPage room={room} words={words} onLeave={handleLeave} />;
  }

  return (
    <div className="mp-hub">
      <div className="page-header">
        <div>
          <h1 className="page-title">🌐 Multiplayer</h1>
          <p className="page-subtitle">Chơi cùng bạn bè qua LAN hoặc Internet</p>
        </div>
        {connected && <div className="connected-badge">🟢 Đã kết nối</div>}
      </div>

      <div className="hub-content">
        {/* SETUP */}
        {hubState === 'setup' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 860 }}>
            {/* Connect */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3>🔌 Kết Nối Server</h3>
              <div className="form-group">
                <label className="form-label">Tên người chơi</label>
                <input className="input" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Nhập tên của bạn..." maxLength={20} />
              </div>
              <div className="form-group">
                <label className="form-label">Server URL</label>
                <input className="input font-mono" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="http://localhost:3001" />
              </div>
              {error && <div className="error-box" style={{ whiteSpace: 'pre-line' }}>⚠️ {error}</div>}
              <button className="btn btn-primary" onClick={handleConnect} disabled={connecting || !playerName.trim()}>
                {connecting ? '⏳ Đang kết nối...' : '🔌 Kết Nối'}
              </button>

              {connected && (
                <>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button className={`auth-btn ${mode === 'create' ? 'active' : ''}`} onClick={() => setMode('create')} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: mode === 'create' ? 'var(--accent)' : 'var(--bg-secondary)', color: mode === 'create' ? 'white' : 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}>
                        ➕ Tạo Phòng
                      </button>
                      <button className={`auth-btn ${mode === 'join' ? 'active' : ''}`} onClick={() => setMode('join')} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: mode === 'join' ? 'var(--accent)' : 'var(--bg-secondary)', color: mode === 'join' ? 'white' : 'var(--text-secondary)', fontFamily: 'inherit', cursor: 'pointer' }}>
                        🚪 Vào Phòng
                      </button>
                    </div>

                    {mode === 'create' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Chọn Game</label>
                          {(Object.entries(GAME_INFO) as [GameType, typeof GAME_INFO.tower][]).map(([t, info]) => (
                            <button key={t} onClick={() => setGameType(t)}
                              className={`game-select-btn ${gameType === t ? 'active' : ''}`}>
                              <span style={{ fontSize: 24 }}>{info.icon}</span>
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{info.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cần {info.minWords} từ · Tối đa {info.maxPlayers} người</div>
                              </div>
                              {wordCount < info.minWords && <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠️ Thiếu từ</span>}
                            </button>
                          ))}
                        </div>
                        {gameType === 'mouse' && (
                          <div className="form-group">
                            <label className="form-label">Số người chơi (2-12)</label>
                            <input className="input" type="number" min={2} max={12} value={maxPlayers} onChange={e => setMaxPlayers(+e.target.value)} />
                          </div>
                        )}
                        {gameType === 'shooter' && (
                          <div className="form-group">
                            <label className="form-label">Thời gian ván (giây)</label>
                            <input className="input" type="number" min={60} max={600} step={30} value={gameDuration} onChange={e => setGameDuration(+e.target.value)} />
                          </div>
                        )}
                        <button className="btn btn-primary" onClick={handleCreate}>➕ Tạo Phòng</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Mã Phòng</label>
                          <input className="input font-mono" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="VD: ABC123" maxLength={6} style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }} />
                        </div>
                        <button className="btn btn-primary" onClick={handleJoin}>🚪 Vào Phòng</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card">
                <h4 style={{ marginBottom: 14, fontSize: 14 }}>🚀 Hướng dẫn nhanh</h4>
                {[
                  ['1️⃣', 'Người host chạy game-server/server.js'],
                  ['2️⃣', 'Dùng ngrok để share qua internet (tùy chọn)'],
                  ['3️⃣', 'Nhập Server URL và tên người chơi'],
                  ['4️⃣', 'Tạo phòng hoặc nhập mã phòng để vào'],
                  ['5️⃣', 'Chọn vũ khí trong Store rồi bắt đầu!'],
                ].map(([n, t]) => (
                  <div key={n as string} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 13 }}>
                    <span>{n}</span><span style={{ color: 'var(--text-secondary)' }}>{t}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <h4 style={{ marginBottom: 12, fontSize: 14 }}>📊 Từ Vựng Hiện Có</h4>
                <div style={{ fontSize: 36, fontWeight: 700, color: wordCount >= 50 ? 'var(--green)' : wordCount >= 20 ? '#f59e0b' : 'var(--red)', textAlign: 'center', marginBottom: 8 }}>{wordCount}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>từ vựng</div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(GAME_INFO).map(([t, info]) => (
                    <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 8px', borderRadius: 6, background: wordCount >= info.minWords ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                      <span>{info.icon} {info.name}</span>
                      <span style={{ color: wordCount >= info.minWords ? 'var(--green)' : 'var(--red)' }}>
                        {wordCount >= info.minWords ? '✅ Đủ' : `❌ Cần ${info.minWords}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ background: 'rgba(99,102,241,0.05)' }}>
                <h4 style={{ marginBottom: 10, fontSize: 14 }}>📡 Chơi qua Internet (ngrok)</h4>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  1. Tải ngrok: <code style={{ color: 'var(--accent-bright)' }}>ngrok.com</code><br/>
                  2. Chạy: <code style={{ color: 'var(--accent-bright)' }}>ngrok http 3001</code><br/>
                  3. Copy URL dạng <code style={{ color: 'var(--accent-bright)' }}>https://xxx.ngrok.io</code><br/>
                  4. Chia sẻ URL cho bạn bè
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOBBY */}
        {hubState === 'lobby' && room && (
          <div style={{ maxWidth: 700 }}>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 32 }}>{GAME_INFO[room.gameType as GameType]?.icon}</span>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{GAME_INFO[room.gameType as GameType]?.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mã phòng: <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--accent-bright)', letterSpacing: 4 }}>{room.id}</span></div>
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleLeave}>← Rời phòng</button>
              </div>

              {/* Players */}
              <div style={{ marginBottom: 20 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>👥 Người chơi ({room.players.length}/{room.settings.maxPlayers})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {room.players.map((p: any) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, border: `1px solid ${p.ready ? 'var(--green)' : 'var(--border)'}` }}>
                      <span style={{ fontSize: 20 }}>🐭</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                      {p.id === room.hostId && <span style={{ fontSize: 11, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: 10 }}>👑 Host</span>}
                      <span style={{ fontSize: 12, color: p.ready ? 'var(--green)' : 'var(--text-muted)' }}>{p.ready ? '✅ Sẵn sàng' : '⏳ Chờ...'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && <div className="error-box" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={handleReady} style={{ flex: 1 }}>
                  {room.players.find((p: any) => p.id === multiplayerService.getSocket()?.id)?.ready ? '❌ Hủy sẵn sàng' : '✅ Sẵn Sàng'}
                </button>
                {room.hostId === multiplayerService.getSocket()?.id && (
                  <button className="btn btn-primary" onClick={handleStart} style={{ flex: 1 }}
                    disabled={room.players.some((p: any) => !p.ready && p.id !== room.hostId)}>
                    ▶ Bắt Đầu Game!
                  </button>
                )}
              </div>
            </div>

            {/* Word count warning */}
            {wordCount < GAME_INFO[room.gameType as GameType]?.minWords && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--red)' }}>
                ⚠️ Cần tối thiểu {GAME_INFO[room.gameType as GameType]?.minWords} từ vựng để chơi! Hiện có {wordCount} từ.
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .mp-hub { padding-bottom: 32px; }
        .hub-content { padding: 24px 32px; }
        .connected-badge { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: var(--green); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; }
        .game-select-btn { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; cursor: pointer; transition: all 0.2s; width: 100%; margin-bottom: 6px; }
        .game-select-btn:hover { border-color: var(--accent); }
        .game-select-btn.active { border-color: var(--accent); background: rgba(99,102,241,0.1); }
        .error-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 12px; font-size: 13px; color: var(--red); }
      `}</style>
    </div>
  );
}

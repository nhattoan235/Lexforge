// src/pages/MultiplayerHub.tsx
import React, { useState, useEffect } from 'react';
import multiplayerService from '../services/multiplayer';
import { db } from '../services/database';
import { useApp } from '../App';
import TowerDefensePage from './games/TowerDefensePage';
import WhackMousePage from './games/WhackMousePage';
import CoopShooterPage from './games/CoopShooterPage';
import './MultiplayerApproved.css';

type HubState = 'setup' | 'lobby' | 'playing';
type GameType = 'tower' | 'mouse' | 'shooter';

const GAME_INFO = {
  tower:   { name: 'Tower Defense',   icon: '🏰', minWords: 50, maxPlayers: 4,  desc: 'Xây tháp bảo vệ thành, gõ từ để tấn công quái' },
  mouse:   { name: 'Whack-a-Mouse',   icon: '🐭', minWords: 20, maxPlayers: 12, desc: 'Đập chuột đối thủ bằng cách gõ từ trên đầu họ' },
  shooter: { name: 'Co-op Shooter',   icon: '🔫', minWords: 20, maxPlayers: 5,  desc: 'Cùng nhau bắn quái, thi điểm số cao nhất' },
};

function GameScene({ type }: { type: GameType }) {
  return <svg className={`lf-mp-scene ${type}`} viewBox="0 0 160 110" role="img" aria-label={GAME_INFO[type].name}>
    {type === 'tower' && <><rect width="160" height="110" rx="11" fill="#153f57"/><circle cx="125" cy="26" r="17" fill="#a8dbda" opacity=".7"/><path d="M0 83 35 69 78 79 112 65 160 80v30H0Z" fill="#285f5b"/><path d="M19 88V48h13V35h21v13h15v40Zm78 0V44h12V29h21v15h12v44Z" fill="#d2dfe1" stroke="#426377" strokeWidth="3"/><path d="M16 49h55m23-5h51" stroke="#91b6be" strokeWidth="5"/><path d="M25 34V23h6v11m15 0V23h6v11m53-6V17h6v11m15 0V17h6v11" stroke="#d2dfe1" strokeWidth="6"/><path d="M42 88V68h10v20m63 0V61h10v27" fill="#315469"/><path d="m68 61 21-10-7 11 6 3-20 4" fill="#ffd16d" stroke="#efaa45" strokeWidth="2"/></>}
    {type === 'mouse' && <><rect width="160" height="110" rx="11" fill="#5b496d"/><path d="M0 83q40-12 80-2 40-10 80 2v27H0Z" fill="#342d51"/><ellipse cx="81" cy="86" rx="51" ry="12" fill="#171c37"/><path d="M51 69c-9-6-15-29-2-37 12-7 23 6 21 18m43 19c9-6 15-29 2-37-12-7-23 6-21 18" fill="#d9a6b6" stroke="#704d73" strokeWidth="3"/><path d="M54 77c0-20 10-38 26-41 16 3 26 21 26 41Z" fill="#e3c1c6" stroke="#704d73" strokeWidth="3"/><circle cx="69" cy="65" r="4" fill="#28324e"/><circle cx="92" cy="65" r="4" fill="#28324e"/><path d="m75 75 6 4 6-4m-25-1-17-4m17 9-18 2m55-7 17-4m-17 9 18 2" fill="none" stroke="#704d73" strokeWidth="2"/><path d="M116 22 137 8l11 14-20 17Z" fill="#ffc96c" stroke="#875d4e" strokeWidth="3"/><path d="m127 38-23 26" stroke="#e5d2ae" strokeWidth="6"/></>}
    {type === 'shooter' && <><rect width="160" height="110" rx="11" fill="#153a4d"/><path d="M0 88 27 67 57 81 96 63l64 22v25H0Z" fill="#244d55"/><circle cx="127" cy="32" r="22" fill="#ffd270"/><path d="M37 87V64l12-13 12 13v23Zm60 0V60l13-15 14 15v27Z" fill="#4bb9ad" stroke="#a0e9d8" strokeWidth="3"/><path d="m51 65 33-26 8 7-32 27" fill="#f3c964"/><path d="m117 62 22-24" stroke="#ffda78" strokeWidth="4"/><circle cx="139" cy="38" r="6" fill="#fff1bb"/></>}
  </svg>;
}

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
    <div className="mp-hub lf-training-page lf-multiplayer-page">
      <div className="page-header lf-training-hero">
        <div>
          <span className="lf-training-eyebrow">CHƠI CÙNG BẠN BÈ</span><h1 className="page-title">Một phòng chơi. <em>Ba cuộc chiến.</em></h1>
          <p className="page-subtitle">Xây tháp, đập chuột hoặc phối hợp bắn quái. <strong>Chọn trận của bạn.</strong></p>
          <div className="lf-training-tags"><span>Tạo hoặc vào phòng</span><span>Ba chế độ</span><span>Chơi qua server</span></div>
        </div>
        <div className="lf-multiplayer-hero-games" aria-hidden="true">{(['tower','mouse','shooter'] as GameType[]).map(type => <div className={`lf-mp-hero-card ${type}`} key={type}><GameScene type={type}/><b>{GAME_INFO[type].name}</b></div>)}</div>
        {connected && <div className="connected-badge">🟢 Đã kết nối</div>}
      </div>

      <div className="hub-content">
        {/* SETUP */}
        {hubState === 'setup' && (
          <div className="lf-multiplayer-setup-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 860 }}>
            {/* Connect */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3>Kết nối để chơi</h3><p className="lf-multiplayer-intro">Nhập tên hiển thị và địa chỉ server của người tạo phòng.</p><div className={`lf-multiplayer-status ${connected ? 'connected' : ''}`}><i>{connected ? '✓' : '◷'}</i><span>{connected ? 'Đã kết nối server' : 'Chưa kết nối server'}</span></div>
              <div className="form-group">
                <label className="form-label">Tên người chơi</label>
                <input className="input" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="Nhập tên của bạn..." maxLength={20} />
              </div>
              <div className="form-group">
                <label className="form-label">Địa chỉ server</label>
                <input className="input font-mono" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="http://localhost:3001" />
              </div>
              {error && <div className="error-box" style={{ whiteSpace: 'pre-line' }}>⚠️ {error}</div>}
              <button className="btn btn-primary" onClick={handleConnect} disabled={connecting || !playerName.trim()}>
                {connecting ? 'Đang kết nối...' : 'Kết nối →'}
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
                              <GameScene type={t}/>
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontWeight: 700 }}>{info.name}</div>
                                <div>Cần {info.minWords} từ · Tối đa {info.maxPlayers} người</div>
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

            {/* Approved games overview */}
            <aside className="lf-multiplayer-games-panel"><h2>Trò chơi có trong phòng</h2><p>Số từ cần dùng được kiểm tra trước khi bắt đầu.</p><div className="lf-multiplayer-vocab"><span>Thư viện từ của bạn</span><b>{wordCount} từ</b></div><div className="lf-multiplayer-games">{(Object.entries(GAME_INFO) as [GameType, typeof GAME_INFO.tower][]).map(([type, info]) => <div key={type}><GameScene type={type}/><span><b>{info.name}</b><small>{type === 'tower' ? 'Xây tháp, giữ thành' : type === 'mouse' ? 'Gõ từ để đập chuột' : 'Phối hợp bắn quái'}</small></span><em className={wordCount >= info.minWords ? 'ready' : ''}>{wordCount >= info.minWords ? 'Đủ từ' : `Cần ${info.minWords} từ`}</em></div>)}</div><div className="lf-multiplayer-guide-strip">Chơi thật cần game server hoạt động và mọi người cùng dùng được địa chỉ server đó.</div></aside>
          </div>
        )}

        {/* LOBBY */}
        {hubState === 'lobby' && room && (
          <div className="lf-mp-lobby">
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="lf-mp-lobby-heading">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <GameScene type={room.gameType as GameType}/>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>{GAME_INFO[room.gameType as GameType]?.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mã phòng: <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--accent-bright)', letterSpacing: 4 }}>{room.id}</span></div>
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={handleLeave}>← Rời phòng</button>
              </div>

              {/* Players */}
              <div className="lf-mp-lobby-players" style={{ marginBottom: 20 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>👥 Người chơi ({room.players.length}/{room.settings.maxPlayers})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {room.players.map((p: any) => (
                    <div key={p.id} className={`lf-mp-player ${p.ready ? 'ready' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8 }}>
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

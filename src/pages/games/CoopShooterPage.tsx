// src/pages/games/CoopShooterPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import multiplayerService from '../../services/multiplayer';

const GUNS: Record<string, any> = {
  pistol:  { name: 'Pistol',  icon: '🔫', price: 0,   damage: 20, color: '#94a3b8' },
  shotgun: { name: 'Shotgun', icon: '💥', price: 150, damage: 40, color: '#f97316' },
  smg:     { name: 'SMG',     icon: '🔥', price: 300, damage: 15, color: '#22c55e' },
  sniper:  { name: 'Sniper',  icon: '🎯', price: 500, damage: 80, color: '#f59e0b' },
  rocket:  { name: 'Rocket',  icon: '🚀', price: 800, damage: 120, color: '#ef4444' },
};

const POWERUP_ICONS: Record<string, string> = {
  rapidfire: '⚡', double_dmg: '💥', shield: '🛡️', gold: '💰',
};

interface Bullet { id: number; x: number; y: number; targetId: number; }
interface Explosion { id: number; x: number; y: number; }
interface Props { room: any; words: any[]; onLeave: () => void; }

export default function CoopShooterPage({ room, words, onLeave }: Props) {
  const [enemies, setEnemies] = useState<any[]>([]);
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(180);
  const [wave, setWave] = useState(1);
  const [input, setInput] = useState('');
  const [myGun, setMyGun] = useState('pistol');
  const [myGold, setMyGold] = useState(0);
  const [myPowerups, setMyPowerups] = useState<string[]>([]);
  const [ultiCooldown, setUltiCooldown] = useState(0);
  const [showUlti, setShowUlti] = useState(false);
  const [ultiPhrase, setUltiPhrase] = useState<string[]>([]);
  const [ultiInput, setUltiInput] = useState('');
  const [ultiTyped, setUltiTyped] = useState<string[]>([]);
  const [ultiTimer, setUltiTimer] = useState(8);
  const [showStore, setShowStore] = useState(false);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [floats, setFloats] = useState<any[]>([]);
  const [gameOver, setGameOver] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ultiInputRef = useRef<HTMLInputElement>(null);
  const bulletId = useRef(0);
  const expId = useRef(0);
  const floatId = useRef(0);
  const ultiTimerRef = useRef<any>(null);
  const myId = multiplayerService.getSocket()?.id;

  useEffect(() => {
    const s = multiplayerService;
    s.on('game:state', ({ enemies: e, players: p, wave: w }: any) => {
      setEnemies(e || []);
      setPlayers(p || {});
      setWave(w || 1);
      const me = p?.[myId!];
      if (me) {
        setUltiCooldown(me.ultiCooldown || 0);
        setMyPowerups(me.powerups || []);
      }
    });
    s.on('timer:tick', ({ timeLeft: t, players: p }: any) => {
      setTimeLeft(t);
      setPlayers(p || {});
      const me = p?.[myId!];
      if (me) setUltiCooldown(me.ultiCooldown || 0);
    });
    s.on('enemy:hit', ({ id, hp, damage, shooterId }: any) => {
      setEnemies(prev => prev.map(e => e.id === id ? { ...e, hp } : e));
      const enemy = enemies.find(e => e.id === id);
      if (shooterId === myId && enemy) addFloat(enemy.x, enemy.y, `-${damage}`, '#ef4444');
    });
    s.on('enemy:die', ({ id, killerId, powerup }: any) => {
      const enemy = enemies.find(e => e.id === id);
      if (enemy) {
        addExplosion(enemy.x, enemy.y);
        if (killerId === myId) {
          setMyGold(g => g + 10);
          if (powerup) {
            setMyPowerups(prev => [...prev, powerup.id]);
            addFloat(enemy.x, enemy.y, `${POWERUP_ICONS[powerup.id]} ${powerup.name}!`, '#f59e0b');
          }
        }
      }
      setEnemies(prev => prev.filter(e => e.id !== id));
    });
    s.on('ulti:fired', ({ playerId, damage, correct, total }: any) => {
      const fid = ++floatId.current;
      setFloats(prev => [...prev, { id: fid, text: `🚀 ULTI! -${damage} (${correct}/${total})`, color: '#f59e0b', x: 50, y: 30 }]);
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== fid)), 2000);
    });
    s.on('ulti:result', ({ success, damage, phrase }: any) => {
      if (success) setMyGold(g => g + damage);
    });
    s.on('game:end', (data: any) => setGameOver(data));

    return () => {
      ['game:state','timer:tick','enemy:hit','enemy:die','ulti:fired','ulti:result','game:end'].forEach(e => s.off(e));
    };
  }, [enemies, myId]);

  const addFloat = (x: number, y: number, text: string, color: string) => {
    const id = ++floatId.current;
    setFloats(prev => [...prev, { id, x, y, text, color }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 900);
  };

  const addExplosion = (x: number, y: number) => {
    const id = ++expId.current;
    setExplosions(prev => [...prev, { id, x, y }]);
    setTimeout(() => setExplosions(prev => prev.filter(e => e.id !== id)), 500);
  };

  const shoot = () => {
    if (!input.trim()) return;
    const ans = input.trim();
    const target = enemies.find(e => e.word.toLowerCase() === ans.toLowerCase());
    if (target) {
      const bid = ++bulletId.current;
      setBullets(prev => [...prev, { id: bid, x: 50, y: 90, targetId: target.id }]);
      setTimeout(() => setBullets(prev => prev.filter(b => b.id !== bid)), 300);
    }
    multiplayerService.emit('shooter:shoot', { roomId: room.id, answer: ans });
    setInput('');
    inputRef.current?.focus();
  };

  const startUlti = () => {
    if (ultiCooldown > 0) return;
    // Generate phrase from words
    const phrase = words.slice(0, 12).map(w => w.English);
    setUltiPhrase(phrase);
    setUltiTyped([]);
    setUltiInput('');
    setUltiTimer(8);
    setShowUlti(true);
    setTimeout(() => ultiInputRef.current?.focus(), 100);
    ultiTimerRef.current = setInterval(() => {
      setUltiTimer(t => {
        if (t <= 1) {
          clearInterval(ultiTimerRef.current);
          submitUlti([]);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const submitUlti = (typed: string[]) => {
    clearInterval(ultiTimerRef.current);
    setShowUlti(false);
    multiplayerService.emit('shooter:ulti', { roomId: room.id, typedWords: typed });
  };

  const handleUltiInput = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && ultiInput.trim()) {
      const word = ultiInput.trim();
      const newTyped = [...ultiTyped, word];
      setUltiTyped(newTyped);
      setUltiInput('');
      if (newTyped.length >= 12) submitUlti(newTyped);
    }
  };

  const buyGun = (gunId: string) => {
    const g = GUNS[gunId];
    if (!g || myGold < g.price) return;
    setMyGold(gold => gold - g.price);
    setMyGun(gunId);
    multiplayerService.emit('store:buy_gun', { roomId: room.id, gunId });
  };

  const timerColor = timeLeft > 90 ? '#10b981' : timeLeft > 30 ? '#f59e0b' : '#ef4444';
  const myData = players[myId!];

  if (gameOver) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, maxWidth: 500, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56 }}>🏆</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>Kết Thúc!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>MVP: {gameOver.winner?.name} 🌟</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {gameOver.ranked?.map((p: any, i: number) => (
            <div key={p.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: i === 0 ? 'rgba(245,158,11,0.1)' : 'var(--bg-secondary)', borderRadius: 8, alignItems: 'center', border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}` }}>
              <span style={{ fontSize: 18 }}>{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: '#6366f1', fontFamily: 'monospace', fontWeight: 700 }}>{p.score.toLocaleString()}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>☠️ {p.kills}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary w-full" onClick={onLeave}>← Về Lobby</button>
      </div>
    </div>
  );

  return (
    <div className="cs-game">
      {/* HUD */}
      <div className="cs-hud">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: timerColor, fontFamily: 'monospace' }}>⏱️ {timeLeft}s</div>
          <div style={{ fontSize: 13, color: '#f59e0b' }}>💰 {myGold}</div>
          <div style={{ fontSize: 13 }}>{GUNS[myGun]?.icon} {GUNS[myGun]?.name}</div>
          <div style={{ fontSize: 13, color: '#60a5fa' }}>🌊 Wave {wave}</div>
        </div>

        {/* Powerups */}
        <div style={{ display: 'flex', gap: 6 }}>
          {myPowerups.map((pu, i) => (
            <div key={i} style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, padding: '3px 8px', fontSize: 13 }}>
              {POWERUP_ICONS[pu]}
            </div>
          ))}
        </div>

        {/* Ulti button */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`ulti-btn ${ultiCooldown === 0 ? 'ready' : ''}`}
            onClick={startUlti} disabled={ultiCooldown > 0}>
            {ultiCooldown > 0 ? `🚀 ${ultiCooldown}s` : '🚀 ULTI!'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowStore(true)}>🛒</button>
          <button className="btn btn-secondary btn-sm" onClick={onLeave}>✕</button>
        </div>
      </div>

      {/* Timer */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: timerColor, width: `${(timeLeft / (room.settings?.duration || 180)) * 100}%`, transition: 'width 1s linear' }} />
      </div>

      {/* Floats */}
      {floats.map(f => (
        <div key={f.id} style={{ position: 'fixed', left: `${f.x}%`, top: `${f.y}%`, transform: 'translateX(-50%)', color: f.color, fontWeight: 700, fontSize: 14, animation: 'floatUp 0.9s ease forwards', pointerEvents: 'none', zIndex: 100, whiteSpace: 'nowrap' }}>{f.text}</div>
      ))}

      <div className="cs-main">
        {/* Game field */}
        <div className="cs-field">
          {/* Enemies */}
          {enemies.map(e => (
            <div key={e.id} className="cs-enemy" style={{ left: `${e.x}%`, top: `${e.y}%` }}>
              {e.powerup && <div style={{ position: 'absolute', top: -18, right: -8, fontSize: 14 }}>{POWERUP_ICONS[e.powerup]}</div>}
              <div className="cs-enemy-hp">
                <div style={{ height: '100%', background: e.hp / e.maxHp > 0.5 ? '#10b981' : '#ef4444', width: `${(e.hp / e.maxHp) * 100}%`, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 24 }}>{e.icon}</div>
              <div className="cs-enemy-word">{e.word}</div>
              {explosions.find(ex => ex.x === e.x && ex.y === e.y) && (
                <div style={{ position: 'absolute', fontSize: 32, animation: 'explode 0.5s forwards', pointerEvents: 'none' }}>💥</div>
              )}
            </div>
          ))}

          {/* Bullets */}
          {bullets.map(b => {
            const target = enemies.find(e => e.id === b.targetId);
            return target ? (
              <div key={b.id} style={{ position: 'absolute', left: `${target.x}%`, top: `${target.y}%`, transform: 'translate(-50%,-50%)', fontSize: 16, animation: 'bulletHit 0.3s forwards', pointerEvents: 'none', zIndex: 20 }}>
                {GUNS[myGun]?.icon}
              </div>
            ) : null;
          })}

          {/* Player scoreboard */}
          <div className="cs-scoreboard">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>🏆 RANKING</div>
            {Object.values(players).sort((a: any, b: any) => b.score - a.score).map((p: any, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 12 }}>
                <span>{['🥇','🥈','🥉'][i] || `${i+1}`}</span>
                <span style={{ flex: 1, fontWeight: p.id === myId ? 700 : 400, color: p.id === myId ? '#818cf8' : 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ color: '#6366f1', fontFamily: 'monospace' }}>{p.score.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Player ship */}
          <div className="player-ship">
            <div style={{ fontSize: 28, filter: 'drop-shadow(0 0 12px #6366f1)' }}>🚀</div>
            <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>{myData?.name || 'You'}</div>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="cs-input-area">
        <span style={{ fontSize: 20 }}>{GUNS[myGun]?.icon}</span>
        <input ref={inputRef} className="cs-input" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && shoot()}
          placeholder="Gõ từ tiếng Anh + Enter để bắn..." autoFocus spellCheck={false} autoComplete="off" />
        <button className="btn btn-primary" onClick={shoot}>🔫 BẮN</button>
      </div>

      {/* Ulti Modal */}
      {showUlti && (
        <div className="modal-overlay">
          <div style={{ background: 'rgba(0,0,0,0.95)', border: '2px solid #f59e0b', borderRadius: 16, padding: 32, maxWidth: 600, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🚀 ULTIMATE!</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Gõ càng nhiều từ càng tốt trong <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 20 }}>{ultiTimer}s</span>!
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {ultiPhrase.map((word, i) => (
                <div key={i} style={{ padding: '4px 12px', borderRadius: 20, background: ultiTyped.includes(word) ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${ultiTyped.includes(word) ? '#10b981' : 'rgba(255,255,255,0.1)'}`, fontSize: 14, color: ultiTyped.includes(word) ? '#10b981' : 'var(--text-secondary)', textDecoration: ultiTyped.includes(word) ? 'line-through' : 'none' }}>
                  {word}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input ref={ultiInputRef} className="input" value={ultiInput}
                onChange={e => setUltiInput(e.target.value)}
                onKeyDown={handleUltiInput}
                placeholder="Gõ từ + Enter..." autoFocus style={{ fontSize: 18, textAlign: 'center' }} />
              <button className="btn btn-primary" onClick={() => submitUlti(ultiTyped)}>🚀 KHAI HỎA!</button>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              Đã gõ: {ultiTyped.length}/12 · Damage phụ thuộc vào tốc độ và số từ đúng
            </div>
          </div>
        </div>
      )}

      {/* Store */}
      {showStore && (
        <div className="modal-overlay" onClick={() => setShowStore(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>🛒 Súng Store</h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: '#f59e0b', fontSize: 14 }}>💰 {myGold}</span>
                <button className="btn btn-icon btn-secondary" onClick={() => setShowStore(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                💡 Súng đắt hơn sẽ mạnh hơn — nhưng giá cũng cao hơn. Cân nhắc vì gold có hạn!
              </p>
              {Object.entries(GUNS).map(([id, g]: any) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 28 }}>{g.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Damage: {g.damage}</div>
                  </div>
                  <button className={`btn btn-sm ${myGun === id ? 'btn-success' : 'btn-primary'}`}
                    onClick={() => buyGun(id)} disabled={myGun === id || myGold < g.price}>
                    {myGun === id ? '✅ Đang dùng' : g.price === 0 ? 'Miễn phí' : `💰 ${g.price}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cs-game { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #050510; }
        .cs-hud { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: rgba(0,0,0,0.8); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .ulti-btn { padding: 6px 16px; border-radius: 8px; border: 2px solid rgba(245,158,11,0.4); background: rgba(245,158,11,0.1); color: #f59e0b; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .ulti-btn.ready { border-color: #f59e0b; background: rgba(245,158,11,0.2); animation: pulse 1s infinite; box-shadow: 0 0 12px rgba(245,158,11,0.3); }
        .ulti-btn:disabled { opacity: 0.5; cursor: not-allowed; animation: none; }
        .cs-main { flex: 1; overflow: hidden; }
        .cs-field { height: 100%; position: relative; background: radial-gradient(ellipse at 50% 100%, #0a0a2e 0%, #050510 70%); overflow: hidden; }
        .cs-enemy { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 3px; z-index: 10; }
        .cs-enemy-hp { width: 44px; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; overflow: hidden; }
        .cs-enemy-word { background: rgba(0,0,0,0.85); border: 1px solid rgba(99,102,241,0.4); border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; white-space: nowrap; color: var(--text-primary); }
        .cs-scoreboard { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.75); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; backdrop-filter: blur(8px); min-width: 170px; }
        .player-ship { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
        .cs-input-area { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: rgba(0,0,0,0.9); border-top: 1px solid var(--border); flex-shrink: 0; }
        .cs-input { flex: 1; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 2px solid var(--border); border-radius: 8px; color: white; font-family: 'JetBrains Mono', monospace; font-size: 18px; outline: none; }
        .cs-input:focus { border-color: var(--accent); }
        @keyframes floatUp { 0% { opacity:1; transform: translateX(-50%) translateY(0); } 100% { opacity:0; transform: translateX(-50%) translateY(-40px); } }
        @keyframes bulletHit { 0% { opacity:1; transform: translate(-50%,-50%) scale(0.5); } 100% { opacity:0; transform: translate(-50%,-50%) scale(2); } }
        @keyframes explode { 0% { opacity:1; transform: translate(-50%,-50%) scale(0.5); } 100% { opacity:0; transform: translate(-50%,-50%) scale(3); } }
      `}</style>
    </div>
  );
}

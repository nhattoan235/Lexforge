// src/pages/games/WhackMousePage.tsx
import React, { useState, useEffect, useRef } from 'react';
import multiplayerService from '../../services/multiplayer';

const HAMMERS: Record<string, any> = {
  wood:    { name: 'Búa Gỗ',   icon: '🔨', price: 0,   damage: 15 },
  stone:   { name: 'Búa Đá',   icon: '🪨', price: 80,  damage: 25 },
  iron:    { name: 'Búa Sắt',  icon: '⚒️', price: 200, damage: 40 },
  golden:  { name: 'Búa Vàng', icon: '🔱', price: 400, damage: 60 },
  thunder: { name: 'Búa Sấm',  icon: '⚡', price: 700, damage: 85 },
};

const MOUSE_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#a855f7','#ec4899','#14b8a6','#f97316','#84cc16','#60a5fa','#e11d48','#7c3aed'];

interface HitEffect { id: number; x: number; y: number; text: string; color: string; }
interface Props { room: any; words: any[]; onLeave: () => void; }

export default function WhackMousePage({ room, words, onLeave }: Props) {
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(120);
  const [myGold, setMyGold] = useState(300);
  const [myHammer, setMyHammer] = useState('wood');
  const [showStore, setShowStore] = useState(false);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);
  const [gameOver, setGameOver] = useState<any>(null);
  const [hammerAnim, setHammerAnim] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const effectId = useRef(0);
  const myId = multiplayerService.getSocket()?.id;

  useEffect(() => {
    const s = multiplayerService;
    s.on('game:state', ({ players: p }: any) => setPlayers(p || {}));
    s.on('players:move', ({ players: p }: any) => setPlayers({ ...p }));
    s.on('timer:tick', ({ timeLeft: t }: any) => setTimeLeft(t));

    s.on('player:hit', ({ targetId, attackerId, damage, crit, stun, targetHp, newWord }: any) => {
      setPlayers(prev => {
        const updated = { ...prev };
        if (updated[targetId]) {
          updated[targetId] = { ...updated[targetId], hp: targetHp, word: { English: newWord }, stunned: stun };
        }
        return updated;
      });
      const target = players[targetId];
      if (target) {
        const id = ++effectId.current;
        setHitEffects(prev => [...prev, {
          id, x: target.x, y: target.y,
          text: crit ? `💥 CRIT! -${damage}` : `🔨 -${damage}`,
          color: crit ? '#f59e0b' : attackerId === myId ? '#ef4444' : '#94a3b8',
        }]);
        setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== id)), 1000);
        if (attackerId === myId) {
          setHammerAnim({ x: target.x, y: target.y });
          setTimeout(() => setHammerAnim(null), 400);
          setMyGold(g => g + damage);
        }
      }
    });

    s.on('player:died', ({ id }: any) => {
      setPlayers(prev => {
        const updated = { ...prev };
        if (updated[id]) updated[id] = { ...updated[id], alive: false };
        return updated;
      });
    });

    s.on('game:end', (data: any) => setGameOver(data));

    return () => {
      ['game:state','players:move','timer:tick','player:hit','player:died','game:end'].forEach(e => s.off(e));
    };
  }, [players, myId]);

  const handleAttack = () => {
    if (!input.trim()) return;
    multiplayerService.emit('mouse:attack', { roomId: room.id, answer: input.trim() });
    setInput('');
    inputRef.current?.focus();
  };

  const buyHammer = (hammerId: string) => {
    const h = HAMMERS[hammerId];
    if (!h || myGold < h.price) return;
    setMyGold(g => g - h.price);
    setMyHammer(hammerId);
    multiplayerService.emit('store:buy_hammer', { roomId: room.id, hammerId });
  };

  const playerList = Object.values(players);
  const timerColor = timeLeft > 60 ? '#10b981' : timeLeft > 30 ? '#f59e0b' : '#ef4444';

  if (gameOver) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 40, textAlign: 'center', maxWidth: 500 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🏆</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Kết Thúc!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>🥇 {gameOver.winner?.name} chiến thắng!</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {gameOver.ranked?.map((p: any, i: number) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: i === 0 ? 'rgba(245,158,11,0.1)' : 'var(--bg-secondary)', borderRadius: 8, border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.3)' : 'var(--border)'}` }}>
              <span style={{ fontSize: 20 }}>{['🥇','🥈','🥉'][i] || `#${i+1}`}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>💰 {p.score}</span>
              <span style={{ color: '#ef4444', fontSize: 13 }}>☠️ {p.kills}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onLeave}>← Về Lobby</button>
      </div>
    </div>
  );

  return (
    <div className="wm-game">
      {/* HUD */}
      <div className="wm-hud">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: timerColor, fontFamily: 'monospace' }}>⏱️ {timeLeft}s</div>
          <div style={{ height: 20, width: 1, background: 'var(--border)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b' }}>💰 {myGold}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{HAMMERS[myHammer]?.icon} {HAMMERS[myHammer]?.name}</div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          👥 {playerList.filter(p => p.alive).length}/{playerList.length} còn sống
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowStore(true)}>🛒 Store</button>
          <button className="btn btn-secondary btn-sm" onClick={onLeave}>✕</button>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: timerColor, width: `${(timeLeft / 120) * 100}%`, transition: 'width 1s linear' }} />
      </div>

      {/* Arena */}
      <div className="wm-arena">
        {/* Players as mice */}
        {playerList.map((p, i) => (
          <div key={p.id} className={`mouse-player ${!p.alive ? 'dead' : ''} ${p.stunned ? 'stunned' : ''}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            {/* Word on head */}
            {p.alive && (
              <div className="mouse-word" style={{ borderColor: `${MOUSE_COLORS[i % MOUSE_COLORS.length]}66`, color: MOUSE_COLORS[i % MOUSE_COLORS.length] }}>
                {p.word?.English || '???'}
              </div>
            )}
            {/* Mouse icon */}
            <div className="mouse-icon" style={{ filter: `drop-shadow(0 0 8px ${MOUSE_COLORS[i % MOUSE_COLORS.length]})` }}>
              {p.alive ? (p.stunned ? '😵' : '🐭') : '💀'}
            </div>
            {/* HP bar */}
            {p.alive && (
              <div className="mouse-hpbar">
                <div style={{ height: '100%', background: p.hp > 60 ? '#10b981' : p.hp > 30 ? '#f59e0b' : '#ef4444', width: `${p.hp}%`, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
            {/* Name */}
            <div className="mouse-name" style={{ color: p.id === myId ? '#818cf8' : 'var(--text-muted)' }}>
              {p.name}{p.id === myId ? ' (bạn)' : ''}
            </div>
          </div>
        ))}

        {/* Hit effects */}
        {hitEffects.map(e => (
          <div key={e.id} style={{ position: 'absolute', left: `${e.x}%`, top: `${e.y}%`, transform: 'translate(-50%, -100%)', color: e.color, fontWeight: 700, fontSize: 14, animation: 'floatUp 1s ease forwards', pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap' }}>
            {e.text}
          </div>
        ))}

        {/* Hammer animation */}
        {hammerAnim && (
          <div style={{ position: 'absolute', left: `${hammerAnim.x}%`, top: `${hammerAnim.y}%`, transform: 'translate(-50%, -50%)', fontSize: 40, animation: 'hammerDown 0.4s ease forwards', pointerEvents: 'none', zIndex: 30 }}>
            {HAMMERS[myHammer]?.icon}
          </div>
        )}

        {/* Scoreboard mini */}
        <div className="wm-scoreboard">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>BẢNG ĐIỂM</div>
          {playerList.sort((a, b) => b.score - a.score).slice(0, 5).map((p, i) => (
            <div key={p.id} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12, opacity: p.alive ? 1 : 0.5 }}>
              <span>{['🥇','🥈','🥉'][i] || `${i+1}.`}</span>
              <span style={{ flex: 1, fontWeight: p.id === myId ? 700 : 400, color: p.id === myId ? '#818cf8' : 'var(--text-primary)' }}>{p.name}</span>
              <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="wm-input-area">
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          🔨 Gõ từ trên đầu chuột đối thủ để đập:
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 1 }}>
          <input ref={inputRef} className="wm-input" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAttack()}
            placeholder="Gõ từ + Enter để đập..." autoFocus spellCheck={false} autoComplete="off" />
          <button className="btn btn-primary" onClick={handleAttack}>
            {HAMMERS[myHammer]?.icon} ĐẬP!
          </button>
        </div>
      </div>

      {/* Store Modal */}
      {showStore && (
        <div className="modal-overlay" onClick={() => setShowStore(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>🛒 Búa Store</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, color: '#f59e0b' }}>💰 {myGold} vàng</span>
                <button className="btn btn-icon btn-secondary" onClick={() => setShowStore(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                💡 Vàng kiếm được từ việc đánh trúng đối thủ. Búa to hơn = đau hơn nhưng đừng quá OP!
              </p>
              {Object.entries(HAMMERS).map(([id, h]: any) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 28 }}>{h.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Damage: {h.damage} · {id === 'golden' ? 'Crit 20%' : id === 'thunder' ? 'Stun 1s' : 'Bình thường'}</div>
                  </div>
                  <button className={`btn btn-sm ${myHammer === id ? 'btn-success' : 'btn-primary'}`}
                    onClick={() => buyHammer(id)} disabled={myHammer === id || myGold < h.price}>
                    {myHammer === id ? '✅ Đang dùng' : h.price === 0 ? 'Miễn phí' : `💰 ${h.price}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .wm-game { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #0a0a1a; }
        .wm-hud { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: rgba(0,0,0,0.7); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .wm-arena { flex: 1; position: relative; overflow: hidden; background: radial-gradient(ellipse at center, #1a1a3e 0%, #080810 100%); }
        .mouse-player { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 3px; transition: left 1.8s ease, top 1.8s ease; }
        .mouse-player.dead { opacity: 0.3; filter: grayscale(1); }
        .mouse-player.stunned { animation: shake 0.5s ease infinite; }
        .mouse-word { background: rgba(0,0,0,0.8); border: 1px solid; border-radius: 6px; padding: 2px 8px; font-size: 12px; font-weight: 700; white-space: nowrap; backdrop-filter: blur(4px); }
        .mouse-icon { font-size: 32px; cursor: default; }
        .mouse-hpbar { width: 44px; height: 5px; background: rgba(255,255,255,0.15); border-radius: 3px; overflow: hidden; }
        .mouse-name { font-size: 10px; white-space: nowrap; }
        .wm-scoreboard { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.7); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; backdrop-filter: blur(8px); min-width: 160px; }
        .wm-input-area { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: rgba(0,0,0,0.8); border-top: 1px solid var(--border); flex-shrink: 0; }
        .wm-input { flex: 1; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 2px solid var(--border); border-radius: 8px; color: white; font-family: 'JetBrains Mono', monospace; font-size: 18px; outline: none; }
        .wm-input:focus { border-color: var(--accent); }
        @keyframes floatUp { 0% { opacity:1; transform: translate(-50%,-100%) translateY(0); } 100% { opacity:0; transform: translate(-50%,-100%) translateY(-40px); } }
        @keyframes hammerDown { 0% { opacity:1; transform: translate(-50%,-50%) scale(0.5) rotate(-30deg); } 50% { transform: translate(-50%,-50%) scale(1.5) rotate(10deg); } 100% { opacity:0; transform: translate(-50%,-50%) scale(1) rotate(0); } }
      `}</style>
    </div>
  );
}
